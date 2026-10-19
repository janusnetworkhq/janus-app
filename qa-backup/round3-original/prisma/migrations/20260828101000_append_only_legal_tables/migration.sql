-- Audit is a legal evidence log. Application code must not UPDATE or DELETE rows.
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_immutable ON "audit_events";
CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW
  EXECUTE PROCEDURE deny_audit_mutation();

-- NDA agreements are immutable except revoke columns.
CREATE OR REPLACE FUNCTION nda_agreements_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'nda_agreements cannot be deleted';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.signer_id IS DISTINCT FROM OLD.signer_id
     OR NEW.signer_name IS DISTINCT FROM OLD.signer_name
     OR NEW.template_sha256 IS DISTINCT FROM OLD.template_sha256
     OR NEW.artifact_s3_key IS DISTINCT FROM OLD.artifact_s3_key
     OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
     OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
     OR NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
    RAISE EXCEPTION 'nda_agreements evidence columns are immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nda_agreements_immutable ON "nda_agreements";
CREATE TRIGGER nda_agreements_immutable
  BEFORE UPDATE OR DELETE ON "nda_agreements"
  FOR EACH ROW
  EXECUTE PROCEDURE nda_agreements_guard();
