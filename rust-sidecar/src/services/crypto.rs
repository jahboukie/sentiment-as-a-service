//! Cryptographic Signing Module - Ed25519 + SHA-256
//! 
//! Ported from SecuraMem Core for RG-Check compliance.
//! Provides court-admissible digital signatures for every policy decision.

use anyhow::Result;
use ed25519_dalek::{Signer as _, Verifier as _, SigningKey, VerifyingKey, Signature};
use rand_core::OsRng;
use ring::digest::{digest, SHA256};
use std::path::Path;

/// Operator signing key for RG-Check evidence
/// 
/// Each operator gets a unique Ed25519 keypair. All policy enforcement
/// events are signed with this key, creating court-admissible proof.
pub struct OperatorSigningKey {
    key: SigningKey,
    key_id: String,
}

impl OperatorSigningKey {
    /// Generate a new random signing key for this operator
    pub fn generate() -> Self {
        let key = SigningKey::generate(&mut OsRng);
        let key_id = Self::compute_key_id(&key.verifying_key());
        
        tracing::info!("Generated new operator signing key: {}", key_id);
        
        Self { key, key_id }
    }
    
    /// Load signing key from PEM file
    pub fn load_from_file(path: &Path) -> Result<Self> {
        use ed25519_dalek::pkcs8::DecodePrivateKey;
        
        let pem = std::fs::read_to_string(path)?;
        let key = SigningKey::from_pkcs8_pem(&pem)
            .map_err(|e| anyhow::anyhow!("Failed to load signing key: {}", e))?;
        
        let key_id = Self::compute_key_id(&key.verifying_key());
        
        tracing::info!("Loaded operator signing key: {}", key_id);
        
        Ok(Self { key, key_id })
    }
    
    /// Save signing key to PEM file
    pub fn save_to_file(&self, path: &Path) -> Result<()> {
        use ed25519_dalek::pkcs8::EncodePrivateKey;
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let pem = self.key
            .to_pkcs8_pem(pkcs8::LineEnding::LF)
            .map_err(|e| anyhow::anyhow!("Failed to encode signing key: {}", e))?;
        
        std::fs::write(path, pem.as_bytes())?;
        
        // Set restrictive permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(path)?.permissions();
            perms.set_mode(0o600); // rw-------
            std::fs::set_permissions(path, perms)?;
        }
        
        tracing::info!("Saved operator signing key to {:?}", path);
        Ok(())
    }
    
    /// Get the key ID (SHA-256 fingerprint of public key)
    pub fn key_id(&self) -> &str {
        &self.key_id
    }
    
    /// Get the verifying (public) key
    pub fn verifying_key(&self) -> VerifyingKey {
        self.key.verifying_key()
    }
    
    /// Export public key as PEM (for RG-Check auditors)
    pub fn verifying_key_pem(&self) -> Result<String> {
        use ed25519_dalek::pkcs8::EncodePublicKey;
        
        self.key
            .verifying_key()
            .to_public_key_pem(pkcs8::LineEnding::LF)
            .map_err(|e| anyhow::anyhow!("Failed to encode public key: {}", e))
    }
    
    /// Sign data and return base64-encoded signature
    pub fn sign(&self, data: &[u8]) -> String {
        use base64::Engine;
        let signature = self.key.sign(data);
        base64::engine::general_purpose::STANDARD.encode(signature.to_bytes())
    }
    
    /// Sign data and return raw signature
    pub fn sign_raw(&self, data: &[u8]) -> Signature {
        self.key.sign(data)
    }
    
    /// Compute key ID from public key (SHA-256 fingerprint)
    fn compute_key_id(public_key: &VerifyingKey) -> String {
        let public_key_bytes = public_key.to_bytes();
        let hash = digest(&SHA256, &public_key_bytes);
        format!("ed25519:sha256:{}", hex::encode(hash.as_ref()))
    }
}

/// Verify an Ed25519 signature
pub fn verify_signature(
    public_key_pem: &str,
    data: &[u8],
    signature_base64: &str,
) -> Result<bool> {
    use ed25519_dalek::pkcs8::DecodePublicKey;
    use base64::Engine;
    
    // Decode public key
    let public_key = VerifyingKey::from_public_key_pem(public_key_pem)
        .map_err(|e| anyhow::anyhow!("Invalid public key: {}", e))?;
    
    // Decode signature
    let signature_bytes = base64::engine::general_purpose::STANDARD
        .decode(signature_base64)
        .map_err(|e| anyhow::anyhow!("Invalid signature encoding: {}", e))?;
    
    let signature = Signature::from_bytes(
        signature_bytes.as_slice().try_into()
            .map_err(|_| anyhow::anyhow!("Invalid signature length"))?
    );
    
    // Verify
    Ok(public_key.verify(data, &signature).is_ok())
}

/// Compute SHA-256 hash and return hex-encoded string
pub fn sha256_hex(data: &[u8]) -> String {
    let hash = digest(&SHA256, data);
    hex::encode(hash.as_ref())
}

/// Compute SHA-256 hash and return raw bytes
pub fn sha256_bytes(data: &[u8]) -> [u8; 32] {
    let hash = digest(&SHA256, data);
    let mut result = [0u8; 32];
    result.copy_from_slice(hash.as_ref());
    result
}

/// Compute hash chain link: SHA256(prev_hash || current_data)
/// 
/// This creates the immutable ledger. Each entry's hash depends on
/// the previous entry's hash, making tampering detectable.
pub fn compute_hash_chain_link(prev_hash: Option<&str>, current_data: &[u8]) -> String {
    let mut input = Vec::new();
    
    // Prepend previous hash (or empty for genesis)
    if let Some(prev) = prev_hash {
        input.extend_from_slice(prev.as_bytes());
    }
    
    // Append current entry data
    input.extend_from_slice(current_data);
    
    // Compute SHA-256 hash
    sha256_hex(&input)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_key_generation() {
        let key = OperatorSigningKey::generate();
        assert!(key.key_id().starts_with("ed25519:sha256:"));
    }
    
    #[test]
    fn test_sign_and_verify() {
        let key = OperatorSigningKey::generate();
        let data = b"RG-Check Policy Decision: ESCALATE_TO_RG_AGENT";
        
        let signature = key.sign(data);
        let public_key_pem = key.verifying_key_pem().unwrap();
        
        let valid = verify_signature(&public_key_pem, data, &signature).unwrap();
        assert!(valid);
        
        // Tampered data should fail
        let tampered = b"RG-Check Policy Decision: NO_ACTION";
        let invalid = verify_signature(&public_key_pem, tampered, &signature).unwrap();
        assert!(!invalid);
    }
    
    #[test]
    fn test_hash_chain() {
        let data1 = b"genesis";
        let hash1 = compute_hash_chain_link(None, data1);
        
        let data2 = b"second entry";
        let hash2 = compute_hash_chain_link(Some(&hash1), data2);
        
        // Hashes should be different
        assert_ne!(hash1, hash2);
        
        // Deterministic
        let hash2_again = compute_hash_chain_link(Some(&hash1), data2);
        assert_eq!(hash2, hash2_again);
    }
}
