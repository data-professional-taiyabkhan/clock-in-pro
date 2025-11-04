# Attendance Management System

A modern, secure employee attendance management system with **AWS-powered facial recognition** for contactless clock-in/out functionality.

## ✨ Features

### 🔐 Advanced Security
- **AWS Rekognition Face Recognition**: 99.9% accuracy with cloud-based AI face matching
- **Multi-Role Access Control**: Employee, Manager, and Administrator roles with specific permissions
- **Location-Based Verification**: GPS geofencing to restrict check-ins to authorized locations
- **Session-Based Authentication**: Secure login system with bcrypt password hashing
- **Real-Time Quality Checks**: Automatic face quality validation before registration

### 📱 Employee Features
- **Contactless Clock-In/Out**: AWS Rekognition face verification for attendance
- **Real-Time Location Verification**: Automatic GPS location validation
- **Attendance History**: View personal records and working hours
- **Dashboard Analytics**: Personal attendance statistics and insights

### 👔 Manager Features
- **Employee Management**: Add, edit, and manage employee profiles
- **Face Image Management**: Upload faces to AWS S3 and Rekognition
- **Attendance Oversight**: Monitor team attendance
- **Location Administration**: Create and manage office locations
- **Team Analytics**: Comprehensive reports and insights

### 🛡️ Administrator Features
- **System-Wide Management**: Complete control over all components
- **User Role Management**: Assign and modify permissions
- **Location Configuration**: Set up office locations and access controls
- **Invitation System**: Send secure invitations to new employees

## 🚀 Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** + **shadcn/ui** for modern UI
- **TanStack Query** for state management
- **React Hook Form** with Zod validation

### Backend
- **Node.js** + **Express.js**
- **TypeScript** for full-stack type safety
- **PostgreSQL** with **Drizzle ORM**
- **AWS SDK v3** for cloud services

### AWS Services
- **AWS Rekognition**: Face recognition (99.9% accuracy)
- **AWS S3**: Scalable image storage
- **AWS RDS PostgreSQL**: Managed database

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database (or AWS RDS)
- AWS Account with Rekognition and S3 access

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AttendanceFaceSyncWeb
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   Create `.env` file:
   ```env
   # Database
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   
   # AWS
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_S3_BUCKET=your-bucket-name
   AWS_REKOGNITION_COLLECTION=attendance-faces
   
   # Security
   SESSION_SECRET=your-random-secret
   NODE_ENV=development
   ```

4. **Set up database**
   ```bash
   npm run db:push
   ```

5. **Set up AWS**
   ```bash
   # Test AWS configuration
   npm run aws:test
   ```

6. **Start the application**
   ```bash
   npm run dev
   ```

Open http://localhost:5000

## 📚 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run check            # TypeScript type checking

# Database
npm run db:push          # Push schema to database
npm run db:verify        # Verify database schema

# AWS Testing
npm run aws:test         # Test all AWS services
npm run aws:test-s3      # Test S3 only
npm run test:db          # Test database only
```

## 🎯 Usage

### Initial Setup
1. **Create Organization**: Register your organization
2. **Add Users**: Create employee accounts
3. **Register Faces**: Upload employee face images (AWS S3 + Rekognition)
4. **Set Locations**: Configure office locations with GPS

### Daily Operations
1. **Clock-In**: Face recognition via AWS Rekognition
2. **Clock-Out**: Secure face verification
3. **Monitor**: Managers view real-time attendance
4. **Reports**: Generate attendance analytics

## 🔒 Security Features

### Face Recognition
- **AWS Rekognition**: Enterprise-grade AI face matching
- **Quality Validation**: Automatic image quality checks
- **Anti-Spoofing**: Built-in liveness detection
- **Similarity Threshold**: Configurable accuracy (default: 99%)

### Data Protection
- **S3 Storage**: Encrypted image storage
- **Secure Sessions**: Session-based auth with bcrypt
- **Role-Based Access**: Granular permissions
- **Audit Logging**: Complete activity tracking

### Location Security
- **GPS Verification**: Real-time location checks
- **Geofencing**: Radius-based access control
- **Anomaly Detection**: Unusual pattern alerts

## 🏗️ Architecture

```
┌─────────────────┐
│   React Frontend│
└────────┬────────┘
         │
┌────────▼────────┐
│  Express Backend│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────────┐
│AWS RDS│ │AWS Services│
│  PostgreSQL     │
│                 │
│   ┌─────────────┴────────────┐
│   │                          │
│┌──▼────────┐     ┌──────────▼─┐
│AWS S3      │     │AWS         │
│(Face Images)│    │Rekognition │
└────────────┘     │(Face Match)│
                   └────────────┘
```

## 📊 AWS Setup Guide

See `START_HERE.md` for complete AWS setup instructions including:
- AWS account setup
- RDS database creation
- S3 bucket configuration
- Rekognition collection setup
- Security group configuration

## 🧪 Testing

```bash
# Test database connection
npm run test:db

# Test AWS services
npm run aws:test

# Test S3 only
npm run aws:test-s3

# Verify schema
npm run db:verify
```

## 🚢 Deployment

### AWS Deployment
1. Create RDS PostgreSQL instance
2. Create S3 bucket for face images
3. Create Rekognition collection
4. Configure security groups
5. Deploy app (Elastic Beanstalk/ECS/Lambda)

### Environment Variables
See `env.aws.template` for required variables.

## 💰 AWS Costs

**Free Tier Includes:**
- RDS: 750 hours/month (db.t3.micro)
- S3: 5GB storage
- Rekognition: 5,000 faces/month

**Typical Monthly Cost:**
- < $5 for small teams (< 50 users)
- Scales with usage

Monitor costs: https://console.aws.amazon.com/billing/

## 📝 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/register` - User registration

### Attendance
- `POST /api/verify-face` - AWS Rekognition face verification
- `POST /api/clock-in` - Clock in
- `POST /api/clock-out` - Clock out
- `GET /api/attendance` - Get records

### Management
- `GET /api/employees` - List employees
- `POST /api/employees/:id/face-image` - Upload face (AWS S3 + Rekognition)
- `GET /api/locations` - List locations
- `POST /api/locations` - Create location

## 🆘 Troubleshooting

**Database issues:**
```bash
npm run db:verify
```

**AWS issues:**
```bash
npm run aws:test
```

**Import errors:**
```bash
npm run check
```

## 📄 Documentation

- `START_HERE.md` - Complete AWS setup guide
- `AWS_MIGRATION_COMPLETE.md` - Migration summary
- `AWS_ARCHITECTURE.md` - Architecture details
- `AWS_COMPLETE_GUIDE.md` - Comprehensive AWS guide

## 🎉 Changelog

### Latest (December 2024)
- ✅ **Migrated to AWS**: Replaced Python/DeepFace with AWS Rekognition
- ✅ **Cloud Storage**: Face images stored in AWS S3
- ✅ **99.9% Accuracy**: Enterprise-grade face recognition
- ✅ **Faster Processing**: No more Python process overhead
- ✅ **Better Scalability**: Auto-scaling AWS infrastructure
- ✅ **Production Ready**: Fully cloud-based architecture

### Previous
- Multi-role access control
- Location-based verification
- Real-time analytics
- Secure session management

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📞 Support

- Documentation in `/docs`
- AWS guides in root directory
- Issues: GitHub Issues

---

**Built with ❤️ using AWS for secure, scalable workforce management.**

**Powered by:** AWS Rekognition | AWS S3 | AWS RDS | Node.js | React | TypeScript
