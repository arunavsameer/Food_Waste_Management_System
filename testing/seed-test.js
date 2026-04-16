import path from 'path'; // Add this line
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupTestEnvironment() {
  console.log("🚀 Setting up local test database...");

  const catererEmail = process.env.TEST_CATERER_EMAIL || 'caterer@test.com';
  const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
  const studentEmail = process.env.TEST_STUDENT_EMAIL || 'student@test.com';
  const defaultPassword = process.env.TEST_STUDENT_PASSWORD || 'testpassword123';

  try {
    // ==========================================
    // 1. CREATE ADMIN
    // ==========================================
    console.log("\n🛡️ Pre-registering and creating Admin...");
    await supabase.from('pre_registrations').insert([{ 
      email: adminEmail, 
      role: 'admin', 
      admin_name: 'Super Admin', 
      phone_no: '1112223333' 
    }]);

    const { data: adminAuth, error: adminErr } = await supabase.auth.admin.createUser({
      email: adminEmail, password: defaultPassword, email_confirm: true
    });
    if (adminErr) throw adminErr;
    
    await supabase.from('admins').insert([{ 
      admin_id: adminAuth.user.id, 
      name: 'Super Admin', 
      phone_no: '1112223333' 
    }]);
    console.log("✅ Admin created successfully!");


    // ==========================================
    // 2. CREATE CATERER
    // ==========================================
    console.log("\n👨‍🍳 Pre-registering and creating Caterer...");
    await supabase.from('pre_registrations').insert([{ 
      email: catererEmail, 
      role: 'caterer', 
      mess_name: 'Test Mess', 
      manager_name: 'Gordon Ramsay', 
      phone_no: '9876543210' 
    }]);

    const { data: catererAuth, error: catererErr } = await supabase.auth.admin.createUser({
      email: catererEmail, password: defaultPassword, email_confirm: true
    });
    if (catererErr) throw catererErr;
    
    const catererId = catererAuth.user.id;
    await supabase.from('caterers').insert([{ 
      caterer_id: catererId, 
      name: 'Test Mess', 
      manager_name: 'Gordon Ramsay', 
      phone_no: '9876543210' 
    }]);
    console.log("✅ Caterer created successfully!");


    // ==========================================
    // 3. CREATE STUDENT
    // ==========================================
    console.log("\n🎓 Pre-registering and creating Student...");
    await supabase.from('pre_registrations').insert([{ 
      email: studentEmail, 
      role: 'student', 
      mess_name: 'Test Mess', 
      caterer_id: catererId, // Linking to the caterer we just created!
      hostel: 'APJ', 
      food_type: 'regular' 
    }]);

    const { data: studentAuth, error: studentErr } = await supabase.auth.admin.createUser({
      email: studentEmail, password: defaultPassword, email_confirm: true
    });
    if (studentErr) throw studentErr;
    
    await supabase.from('students').insert([{ 
      id: studentAuth.user.id, 
      roll_no: 'CSE23000123', 
      name: 'Test Student', 
      hostel: 'APJ', 
      food_type: 'regular', 
      caterer_id: catererId 
    }]);
    console.log("✅ Student created successfully!");

    console.log("\n🎉 Database seeded successfully! All triggers fired without error.");

  } catch (error) {
    console.error("\n❌ Seeding Error:", error.message || error);
  }
}

setupTestEnvironment();