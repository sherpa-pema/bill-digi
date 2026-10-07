import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const deployDir = path.join(rootDir, 'deploy');

console.log('📦 Starting deployment preparation for Hostinger (www.sanobill.com)...');

// 1. Build project
console.log('⚙️  Running production build (tsc & vite build)...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Re-create deploy directory
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir, { recursive: true });

// 3. Copy dist contents to deploy
console.log('📂 Copying compiled assets into deploy/ directory...');
fs.cpSync(distDir, deployDir, { recursive: true });

// Verify .htaccess exists in deploy
const htaccessPath = path.join(deployDir, '.htaccess');
if (!fs.existsSync(htaccessPath)) {
  const publicHtaccess = path.join(rootDir, 'public', '.htaccess');
  if (fs.existsSync(publicHtaccess)) {
    fs.copyFileSync(publicHtaccess, htaccessPath);
  } else {
    console.warn('⚠️ Warning: .htaccess not found!');
  }
}

// 4. Create Hostinger instructions inside deploy/
const instructions = `# SanoBill (www.sanobill.com) - Hostinger Deployment Guide

## Option A: One-Click Upload (Recommended)
1. Log in to your Hostinger hPanel (https://hpanel.hostinger.com).
2. Go to **Websites** -> select **sanobill.com** -> click **File Manager**.
3. Open the **public_html** directory.
4. If there is a default Hostinger 'default.php' or placeholder file, delete it.
5. Upload the **sanobill-deploy.zip** file located in this deploy folder.
6. Right-click on **sanobill-deploy.zip** and click **Extract**. Extract directly into \`public_html\`.
7. Delete \`sanobill-deploy.zip\` after extracting.

## Option B: Upload Folder Contents Directly
1. Open the \`deploy/\` folder on your computer.
2. Select ALL files (make sure hidden files like \`.htaccess\` are visible and selected) and the \`assets/\` folder.
3. Drag & drop them into Hostinger's \`public_html\` directory.

---

## IMPORTANT: Backend & Supabase Configuration
1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/jobwkztgamvzuipwagrt
2. Navigate to **Authentication** -> **URL Configuration**.
3. Set **Site URL** to:
   https://www.sanobill.com
4. Under **Redirect URLs**, add:
   - https://www.sanobill.com/**
   - https://sanobill.com/**
   - http://localhost:5173/**
5. Click **Save Changes**.

---

## Domain & SSL Verification
- In Hostinger hPanel, go to **Security** -> **SSL** and make sure the Let's Encrypt SSL certificate is Active for both \`sanobill.com\` and \`www.sanobill.com\`.
- All routes (e.g. \`https://www.sanobill.com/billshare?data=...\`) will be routed cleanly without 404 errors thanks to the included \`.htaccess\` file.
`;

fs.writeFileSync(path.join(deployDir, 'HOSTINGER_DEPLOY_INSTRUCTIONS.md'), instructions, 'utf-8');

// 5. Create zip file for 1-click upload
console.log('🗜️  Creating sanobill-deploy.zip for easy Hostinger upload...');
try {
  // Zip the contents of dist into deploy/sanobill-deploy.zip
  // Note: we zip dist contents directly so extracting into public_html puts files right in root
  execSync('zip -r -q ../deploy/sanobill-deploy.zip . -x "*.DS_Store"', { cwd: distDir, stdio: 'inherit' });
  console.log('✅ sanobill-deploy.zip created successfully!');
} catch (err) {
  console.error('Failed to create zip file via CLI zip:', err.message);
}

console.log('\n🎉 Deploy folder successfully created at: ' + deployDir);
console.log('Ready to upload to Hostinger public_html!\n');
