import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function diagnose() {
    console.log('\n=== DIAGNOSIS REPORT ===\n');

    // 1. Check if user exists
    console.log('1. Checking if user tester@gmail.com exists...');
    const { data: users, error: userError } = await supabase
        .from('auth_users')
        .select('*')
        .eq('email', 'tester@gmail.com');

    if (userError) {
        console.log('❌ Error fetching user:', userError.message);
        return;
    }

    if (!users || users.length === 0) {
        console.log('❌ User not found in database');
        console.log('Creating user manually now...');

        // Create the user
        const passwordHash = await bcrypt.hash('test12345', 10);
        const { data: newUser, error: insertError } = await supabase
            .from('auth_users')
            .insert([{
                email: 'tester@gmail.com',
                password_hash: passwordHash,
                full_name: 'Test User',
                is_active: true
            }])
            .select();

        if (insertError) {
            console.log('❌ Error creating user:', insertError.message);
            return;
        }

        console.log('✅ User created successfully');
        return;
    }

    const user = users[0];

    console.log('✅ User found:', {
        email: user.email,
        is_active: user.is_active,
        password_hash: user.password_hash.substring(0, 20) + '...',
    });

    // 2. Test password comparison
    console.log('\n2. Testing password comparison...');
    const testPassword = 'test12345';
    const stored_hash = user.password_hash;

    console.log('Testing password:', testPassword);
    console.log('Stored hash:', stored_hash.substring(0, 30) + '...');

    try {
        const isMatch = await bcrypt.compare(testPassword, stored_hash);
        if (isMatch) {
            console.log('✅ Password matches!');
        } else {
            console.log('❌ Password does NOT match');

            // Try to hash the password fresh and see if there's a difference
            console.log('\n3. Testing fresh hash...');
            const freshHash = await bcrypt.hash(testPassword, 10);
            console.log('Fresh hash:', freshHash);
            const freshMatch = await bcrypt.compare(testPassword, freshHash);
            console.log('Fresh hash matches:', freshMatch);
        }
    } catch (err) {
        console.log('❌ Error during password comparison:', err.message);
    }

    console.log('\n=== END DIAGNOSIS ===\n');
    process.exit(0);
}

diagnose();
