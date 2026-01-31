-- ============================================
-- BTCPay Webhook Logs Table
-- Stores all incoming webhook events for audit/debugging
-- ============================================

CREATE TABLE IF NOT EXISTS btcpay_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,
    invoice_id TEXT NOT NULL,
    store_id TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    gift_code_id UUID REFERENCES gift_codes(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_btcpay_logs_invoice_id ON btcpay_webhook_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_btcpay_logs_event_type ON btcpay_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_btcpay_logs_received_at ON btcpay_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_btcpay_logs_processed ON btcpay_webhook_logs(processed) WHERE processed = FALSE;

-- Add payment_method and payment_details to gift_codes if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'gift_codes' AND column_name = 'payment_method') THEN
        ALTER TABLE gift_codes ADD COLUMN payment_method TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'gift_codes' AND column_name = 'payment_details') THEN
        ALTER TABLE gift_codes ADD COLUMN payment_details JSONB;
    END IF;
END $$;

-- Create index on payment method
CREATE INDEX IF NOT EXISTS idx_gift_codes_payment_method ON gift_codes(payment_method);

-- ============================================
-- Email Queue Table (for async notifications)
-- ============================================

CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template TEXT NOT NULL,
    to_email TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE btcpay_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access these tables
CREATE POLICY "Service role access only - btcpay_logs" ON btcpay_webhook_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access only - email_queue" ON email_queue
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE btcpay_webhook_logs IS 'Audit log of all BTCPay webhook events received';
COMMENT ON TABLE email_queue IS 'Queue for outgoing email notifications';
COMMENT ON COLUMN btcpay_webhook_logs.request_id IS 'Unique ID generated per webhook request for tracing';
COMMENT ON COLUMN btcpay_webhook_logs.processed IS 'Whether this event resulted in a gift code creation';
