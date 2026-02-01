/**
 * Script to create the 'avatars' bucket in Supabase Storage
 * Run with: node scripts/create-avatar-bucket.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://guioxfulihyehrwytxce.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aW94ZnVsaWh5ZWhyd3l0eGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgwODk2NSwiZXhwIjoyMDg1Mzg0OTY1fQ.-T6FJ-VRa13s1CAERatrUXKZsOFS4zxUG32HWLcAeAM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createAvatarBucket() {
    console.log('Creating avatars bucket...');
    
    try {
        // Check if bucket already exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('Error listing buckets:', listError);
            return;
        }
        
        const existingBucket = buckets.find(bucket => bucket.name === 'avatars');
        if (existingBucket) {
            console.log('✓ Avatars bucket already exists');
            return;
        }
        
        // Create the bucket
        const { data, error } = await supabase.storage.createBucket('avatars', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            fileSizeLimit: 2097152 // 2MB
        });
        
        if (error) {
            console.error('Error creating bucket:', error);
            return;
        }
        
        console.log('✓ Avatars bucket created successfully');
        
        // Set bucket policy to allow public access for reading
        const { error: policyError } = await supabase.storage.from('avatars')
            .createSignedUrl('test', 60); // This will fail but trigger policy creation
        
        if (policyError && !policyError.message.includes('Object not found')) {
            console.warn('Note: You may need to manually set storage policies in Supabase Dashboard');
        }
        
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Run the script
createAvatarBucket().then(() => {
    console.log('Done!');
    process.exit(0);
});