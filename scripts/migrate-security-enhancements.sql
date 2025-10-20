-- Migration script for security enhancements
-- Run this script to add the new security features to your PostgreSQL database

-- 1. Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS face_embedding_vector TEXT,
ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_pin_used TIMESTAMP;

-- 3. Create attendance_verification_logs table
CREATE TABLE IF NOT EXISTS attendance_verification_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    attempt_time TIMESTAMP DEFAULT NOW(),
    verification_type VARCHAR(10) NOT NULL CHECK (verification_type IN ('face', 'pin')),
    success BOOLEAN NOT NULL,
    face_confidence REAL,
    liveness_score REAL,
    location_latitude REAL,
    location_longitude REAL,
    device_info TEXT,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_verification_logs_organization_id ON attendance_verification_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_user_id ON attendance_verification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_attempt_time ON attendance_verification_logs(attempt_time);
CREATE INDEX IF NOT EXISTS idx_verification_logs_verification_type ON attendance_verification_logs(verification_type);
CREATE INDEX IF NOT EXISTS idx_verification_logs_success ON attendance_verification_logs(success);
CREATE INDEX IF NOT EXISTS idx_verification_logs_composite ON attendance_verification_logs(organization_id, user_id, attempt_time);

-- 5. Create index on face_embedding_vector for pgvector operations (when data is populated)
-- Note: This will be created after data migration
-- CREATE INDEX IF NOT EXISTS idx_users_face_embedding_vector ON users USING ivfflat (face_embedding_vector vector_cosine_ops) WITH (lists = 100);

-- 6. Update attendance_records table to support new check-in methods
ALTER TABLE attendance_records 
ALTER COLUMN check_in_method SET DEFAULT 'face';

-- Add constraint to ensure check_in_method is valid
ALTER TABLE attendance_records 
ADD CONSTRAINT IF NOT EXISTS check_attendance_method 
CHECK (check_in_method IN ('face', 'manual', 'pin'));

-- 7. Create function to migrate existing face embeddings to vector format
CREATE OR REPLACE FUNCTION migrate_face_embeddings_to_vector()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    embedding_array REAL[];
    vector_string TEXT;
    migrated_count INTEGER := 0;
BEGIN
    -- Loop through users with face embeddings
    FOR user_record IN 
        SELECT id, face_embedding 
        FROM users 
        WHERE face_embedding IS NOT NULL 
        AND face_embedding_vector IS NULL
    LOOP
        -- Convert JSON array to REAL array
        BEGIN
            -- Parse the JSON embedding and convert to vector string
            embedding_array := ARRAY(
                SELECT jsonb_array_elements_text(user_record.face_embedding::jsonb)::REAL
            );
            
            -- Convert to pgvector format: '[1.0,2.0,3.0]' format
            vector_string := '[' || array_to_string(embedding_array, ',') || ']';
            
            -- Update the user record
            UPDATE users 
            SET face_embedding_vector = vector_string
            WHERE id = user_record.id;
            
            migrated_count := migrated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue migration
            RAISE NOTICE 'Failed to migrate embedding for user %: %', user_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to create vector index after migration
CREATE OR REPLACE FUNCTION create_vector_index()
RETURNS VOID AS $$
BEGIN
    -- Create vector index for similarity search
    -- This assumes embeddings are 128-dimensional vectors
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_face_embedding_vector 
             ON users USING ivfflat (face_embedding_vector::vector vector_cosine_ops) 
             WITH (lists = 100)';
             
    RAISE NOTICE 'Vector index created successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create vector index: %', SQLERRM;
    RAISE NOTICE 'You may need to run this manually after ensuring pgvector extension is properly installed';
END;
$$ LANGUAGE plpgsql;

-- 9. Create function for face similarity search
CREATE OR REPLACE FUNCTION find_similar_faces(
    input_vector TEXT,
    threshold REAL DEFAULT 0.6,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    user_id INTEGER,
    similarity REAL,
    user_email VARCHAR,
    user_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        1 - (u.face_embedding_vector::vector <=> input_vector::vector) as similarity,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM users u
    WHERE u.face_embedding_vector IS NOT NULL
    AND u.is_active = TRUE
    AND 1 - (u.face_embedding_vector::vector <=> input_vector::vector) > threshold
    ORDER BY u.face_embedding_vector::vector <=> input_vector::vector
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- 10. Create view for security monitoring
CREATE OR REPLACE VIEW security_summary AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    COUNT(avl.id) as total_attempts,
    COUNT(CASE WHEN avl.success THEN 1 END) as successful_attempts,
    COUNT(CASE WHEN NOT avl.success THEN 1 END) as failed_attempts,
    COUNT(CASE WHEN avl.verification_type = 'pin' AND avl.success THEN 1 END) as pin_usage,
    COUNT(CASE WHEN avl.attempt_time > NOW() - INTERVAL '24 hours' AND NOT avl.success THEN 1 END) as recent_failures,
    ROUND(
        (COUNT(CASE WHEN avl.success THEN 1 END)::REAL / NULLIF(COUNT(avl.id), 0)) * 100, 
        2
    ) as success_rate
FROM organizations o
LEFT JOIN attendance_verification_logs avl ON o.id = avl.organization_id
GROUP BY o.id, o.name;

-- 11. Create function to clean up old audit logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM attendance_verification_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % old audit log entries (older than % days)', deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 12. Create trigger to automatically log PIN usage for managers
CREATE OR REPLACE FUNCTION notify_pin_usage()
RETURNS TRIGGER AS $$
DECLARE
    user_org_id INTEGER;
    user_name TEXT;
BEGIN
    -- Only trigger on successful PIN verifications
    IF NEW.verification_type = 'pin' AND NEW.success = TRUE THEN
        -- Get user and organization info
        SELECT u.organization_id, CONCAT(u.first_name, ' ', u.last_name)
        INTO user_org_id, user_name
        FROM users u
        WHERE u.id = NEW.user_id;
        
        -- Log the PIN usage for manager notification
        -- This could be extended to send actual notifications
        RAISE NOTICE 'PIN usage alert: User % (%) used PIN authentication on %', 
                     user_name, NEW.user_id, NEW.attempt_time;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_pin_usage
    AFTER INSERT ON attendance_verification_logs
    FOR EACH ROW
    EXECUTE FUNCTION notify_pin_usage();

-- 13. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_verification_logs TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE attendance_verification_logs_id_seq TO PUBLIC;
GRANT SELECT ON security_summary TO PUBLIC;

-- 14. Create sample data for testing (optional)
-- Uncomment the following lines to create sample audit log entries for testing

/*
INSERT INTO attendance_verification_logs (
    organization_id, user_id, verification_type, success, 
    face_confidence, liveness_score, device_info
) VALUES 
(1, 1, 'face', true, 95.5, 88.2, '{"browser": "Chrome", "platform": "Windows"}'),
(1, 1, 'face', false, 45.2, 92.1, '{"browser": "Chrome", "platform": "Windows"}'),
(1, 2, 'pin', true, null, null, '{"browser": "Safari", "platform": "iOS"}');
*/

-- Migration completed successfully
SELECT 'Security enhancements migration completed successfully!' as status;

-- To run the migration functions, execute:
-- SELECT migrate_face_embeddings_to_vector();
-- SELECT create_vector_index();

-- To test similarity search:
-- SELECT * FROM find_similar_faces('[0.1,0.2,0.3,...]', 0.7, 5);

-- To view security summary:
-- SELECT * FROM security_summary;

-- To cleanup old logs (run periodically):
-- SELECT cleanup_old_audit_logs(90);
