// Yeti Wells Nautilus enclave app — adapted from MystenLabs/nautilus weather-example.
// Copy to: nautilus/src/nautilus-server/src/apps/yeti_wells/mod.rs  (+ allowed_endpoints.yaml)
// Wire it per ../README.md (lib.rs module + Cargo feature `yeti-wells` + main.rs api_key).
//
// The enclave reads a flow-meter reading from SENSOR_URL, builds a MilestoneReport, and returns it
// wrapped in a Nautilus IntentMessage signed by the enclave ephemeral key. The Move contract
// (yeti_wells::attestation::submit_attested_milestone_v2) verifies the signature against the
// registered enclave PCRs/pubkey before releasing escrow. MilestoneReport BCS layout MUST match
// the Move struct (and the TS signer) byte-for-byte.
use crate::common::IntentMessage;
use crate::common::{to_signed_response, ProcessDataRequest, ProcessedDataResponse};
use crate::AppState;
use crate::EnclaveError;
use axum::extract::State;
use axum::Json;
use fastcrypto::encoding::{Encoding, Hex};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::sync::Arc;

/// Intent scope — MUST equal `MILESTONE_INTENT` (1) in yeti_wells::attestation.
#[derive(Serialize_repr, Deserialize_repr, Debug)]
#[repr(u8)]
pub enum IntentScope {
    Milestone = 1,
}

/// Inner T for IntentMessage<T> — byte-for-byte mirror of Move `yeti_wells::attestation::MilestoneReport`.
/// `project_id` is a Sui address = 32 raw bytes (BCS fixed array, no length prefix).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MilestoneReport {
    pub project_id: [u8; 32],
    pub milestone_index: u64,
    pub liters_reading: u64,
    pub timestamp_ms: u64,
}

/// Request payload from the steward backend.
#[derive(Debug, Serialize, Deserialize)]
pub struct MilestoneRequest {
    pub project_id: String, // 0x-prefixed Sui address
    pub milestone_index: u64,
}

fn parse_address(s: &str) -> Result<[u8; 32], EnclaveError> {
    let h = s.strip_prefix("0x").unwrap_or(s);
    let bytes = Hex::decode(h).map_err(|e| EnclaveError::GenericError(format!("bad project_id: {e}")))?;
    if bytes.len() > 32 {
        return Err(EnclaveError::GenericError("project_id too long".to_string()));
    }
    let mut out = [0u8; 32];
    out[32 - bytes.len()..].copy_from_slice(&bytes); // left-pad like a Sui address
    Ok(out)
}

pub async fn process_data(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ProcessDataRequest<MilestoneRequest>>,
) -> Result<Json<ProcessedDataResponse<IntentMessage<MilestoneReport>>>, EnclaveError> {
    let project_id = parse_address(&request.payload.project_id)?;

    // Read the trusted flow-meter feed: SENSOR_URL must return JSON { "liters": <u64> }.
    let sensor_url = std::env::var("SENSOR_URL")
        .map_err(|_| EnclaveError::GenericError("SENSOR_URL must be set".to_string()))?;
    let resp = reqwest::get(&sensor_url)
        .await
        .map_err(|e| EnclaveError::GenericError(format!("sensor fetch failed: {e}")))?;
    let json = resp
        .json::<Value>()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("sensor parse failed: {e}")))?;
    let liters_reading = json["liters"]
        .as_u64()
        .ok_or_else(|| EnclaveError::GenericError("sensor: missing 'liters'".to_string()))?;

    let timestamp_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("clock error: {e}")))?
        .as_millis() as u64;

    Ok(Json(to_signed_response(
        &state.eph_kp,
        MilestoneReport {
            project_id,
            milestone_index: request.payload.milestone_index,
            liters_reading,
            timestamp_ms,
        },
        timestamp_ms,
        IntentScope::Milestone as u8,
    )))
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_serde() {
        // MUST match yeti_wells::attestation_tests::test_v2_intent_serde and scripts/gen_attestation_vector.ts.
        let project_id = parse_address("0x63d9a65220318469fb169034d8a011eae3f014fed2a1f8c006183e2ece3c3975").unwrap();
        let report = MilestoneReport { project_id, milestone_index: 0, liters_reading: 60_000, timestamp_ms: 1_000 };
        let intent_msg = IntentMessage::new(report, 1_000, IntentScope::Milestone as u8);
        let bytes = bcs::to_bytes(&intent_msg).expect("bcs");
        assert_eq!(
            Hex::encode(bytes),
            "01e80300000000000063d9a65220318469fb169034d8a011eae3f014fed2a1f8c006183e2ece3c3975000000000000000060ea000000000000e803000000000000"
        );
    }
}
