# Roundi - Delivery Management Platform

*Complete delivery management solution with onboarding and authentication*

[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## 🚀 Features

### **Authentication & Onboarding**
- **Complete authentication flow** with login/signup
- **Organization setup wizard** for new companies
- **Driver onboarding portal** with document upload
- **Feature tour** for first-time users
- **Team invitation system** with role management

### **Delivery Management**
- **Smart route planning** with AI optimization
- **Real-time driver tracking** and assignment
- **Delivery status monitoring** with customer updates
- **Performance analytics** and reporting
- **Interactive maps** with route visualization

### **Team Management**
- **Driver management** with status tracking
- **Role-based access control** (Admin, Manager, Driver)
- **Team invitations** via email or shareable links
- **Performance monitoring** and analytics

## 🔐 Authentication Flow

### **New Users (First Visit)**
1. **Landing Page** (`/`) - Login/Signup forms with feature showcase
2. **Organization Setup** - Company details and configuration
3. **Welcome Screen** - Next steps and onboarding completion
4. **Dashboard Access** (`/dashboard`) - Main application interface

### **Existing Users**
1. **Login** (`/`) - Direct authentication
2. **Dashboard** (`/dashboard`) - Immediate access to main app

### **Driver Onboarding**
- **Dedicated portal** (`/onboarding/driver`) for new drivers
- **Multi-step process**: Personal info → Vehicle details → Document upload → Verification
- **Professional completion** with next steps and support

## 🎯 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account (for database)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd roundi_v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env-template.txt .env.local
   # Add your Supabase credentials
   ```

4. **Database setup**
   ```bash
   # Run the SQL migrations in order:
   # 01_create_drivers_table.sql
   # 02_create_routes_table.sql
   # 03_create_deliveries_table.sql
   # ... (see sql/ directory)
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Visit** `http://localhost:3000` to see the authentication flow

## 📁 Project Structure

```
roundi_v2/
├── app/
│   ├── page.tsx                 # Authentication landing page
│   ├── dashboard/
│   │   └── page.tsx            # Main dashboard (protected)
│   ├── onboarding/
│   │   └── driver/
│   │       └── page.tsx        # Driver registration portal
│   └── screens/                # Dashboard screens
├── components/
│   ├── feature-tour.tsx        # Interactive feature tour
│   └── ui/                     # Reusable UI components
├── lib/
│   ├── supabase.ts            # Database client
│   └── services/              # Data services
└── sql/                       # Database migrations
```

## 🎪 User Journey

### **Company Admin**
1. Sign up at landing page
2. Complete organization setup
3. Access dashboard with full permissions
4. Invite drivers and team members
5. Manage routes, deliveries, and analytics

### **Driver**
1. Receive invitation link or use public registration
2. Complete driver onboarding process
3. Upload required documents
4. Wait for approval
5. Access driver mobile app (future feature)

### **Team Member**
1. Receive email invitation
2. Sign up with role-specific permissions
3. Access relevant dashboard sections
4. Collaborate on delivery operations

## 🔧 Key Components

### **Authentication System**
- **Unified login/signup** with beautiful UI
- **Organization setup** for business configuration
- **Role-based permissions** (Admin, Manager, Driver)
- **Secure state management** with localStorage

### **Onboarding Experience**
- **Feature tour** with step-by-step guidance
- **Welcome banners** for first-time users
- **Progress tracking** through setup process
- **Help system** with tour replay and support

### **Dashboard Features**
- **Route management** with map integration
- **Driver assignment** and tracking
- **Delivery monitoring** with status updates
- **Analytics and reporting** for performance insights
- **Settings and team management**

## 🛠️ Customization

### **Branding**
- Update logo and colors in components
- Modify feature descriptions in onboarding
- Customize email templates for invitations

### **Features**
- Add new dashboard screens in `app/screens/`
- Extend the feature tour in `components/feature-tour.tsx`
- Create new user roles and permissions

### **Database**
- Add new tables in `sql/` directory
- Extend services in `lib/services/`
- Update TypeScript types in `lib/supabase.ts`

## 🚀 Deployment

### **Production Build**
```bash
npm run build
npm start
```

### **Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 🆘 Support

- **Documentation**: Check `/SUPABASE_SETUP.md` for database setup
- **Issues**: Create issues for bugs or feature requests
- **Customization**: Modify according to your business needs

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ for delivery businesses worldwide**
