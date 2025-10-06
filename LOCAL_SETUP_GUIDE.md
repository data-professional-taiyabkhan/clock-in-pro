# Local Setup Guide - Attendance Face Sync Web

## Prerequisites Status
- ✅ Node.js v20.19.4 installed
- ✅ Python 3.11.1 installed  
- ⏳ PostgreSQL needs to be installed

## Step 1: Install PostgreSQL

### Option A: Local PostgreSQL Installation (Recommended)
1. Download from: https://www.postgresql.org/download/windows/
2. Run installer with these settings:
   - Port: 5432 (default)
   - Username: postgres
   - Password: (set your own - remember this!)
3. After installation, create the database:
   ```powershell
   # Open PowerShell and run:
   psql -U postgres
   # When prompted, enter your password
   # Then in psql console:
   CREATE DATABASE attendance_db;
   \q
   ```

### Option B: Docker PostgreSQL
```powershell
docker run --name attendance-postgres -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres:15
docker exec -it attendance-postgres psql -U postgres -c "CREATE DATABASE attendance_db;"
```

### Option C: Cloud Database (Fastest for testing)
- Sign up at https://neon.tech (free tier)
- Create a new project
- Copy the connection string

## Step 2: Create .env File

Create a `.env` file in the project root with this content:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/attendance_db

# Session Secret (Change this!)
SESSION_SECRET=change_this_to_a_random_secure_string_at_least_32_characters_long

# Environment
NODE_ENV=development

# Server Configuration
PORT=5000
```

**Important:** Replace `yourpassword` with your actual PostgreSQL password!

## Step 3: Install Node.js Dependencies

```powershell
npm install
```

## Step 4: Install Python Dependencies

```powershell
pip install -r python-requirements.txt
```

Or install individually:
```powershell
pip install deepface==0.0.79 tensorflow==2.13.0 opencv-python==4.8.1.78 Pillow==10.0.1 numpy==1.24.3
```

## Step 5: Push Database Schema

```powershell
npm run db:push
```

This will create all necessary tables in your database.

## Step 6: Start the Application

```powershell
npm run dev
```

The application will be available at: http://localhost:5000

## First Time Setup

1. Open http://localhost:5000 in your browser
2. You'll need to create the first organization and admin user
3. The system uses a developer account for initial setup:
   - Email: `developer@saas.com`
   - Password: `dev_super_secure_2025`

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check your DATABASE_URL is correct
- Ensure the database `attendance_db` exists

### Python Dependencies Issues
If TensorFlow installation fails on Windows:
```powershell
pip install tensorflow-cpu==2.13.0
```

### Port Already in Use
If port 5000 is taken, change it in `.env`:
```env
PORT=3000
```

### Face Recognition Not Working
Ensure Python is accessible from command line:
```powershell
python --version
```

Should show Python 3.11+

## Database Schema

The system creates these tables automatically:
- `organizations` - Multi-tenant organization data
- `users` - Employee, Manager, Admin accounts
- `locations` - Office locations with GPS coordinates
- `attendance_records` - Clock-in/out records
- `employee_invitations` - Invitation system
- `employee_locations` - Employee-location assignments

## Next Steps

Once running, you can:
1. Create organizations
2. Add employees
3. Upload face images for employees
4. Set up office locations
5. Test face recognition attendance

## Need Help?

Check the main README.md for feature documentation and API endpoints.

