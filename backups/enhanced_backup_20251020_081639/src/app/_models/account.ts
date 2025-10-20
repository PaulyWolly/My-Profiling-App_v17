import { Role } from './role';
import { ProfileTemplateType } from './profile-template';

export interface FollowerImage {
    id?: string;
    name: string;
    email?: string;
    title?: string;
    imageUrl?: string;
    path?: string;
    imageFile?: File;
}

export interface Education {
    institution: string;
    degree: string;
    years: string;
    description?: string;
}

export interface Account {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    jwtToken: string;
    refreshToken?: string;
    isVerified: boolean;
    created?: Date;
    updated?: Date;
    profileImage?: string;
    coverImage?: string;
    username?: string;
    isDeleting?: boolean;
    imagePath?: string;
    profileTemplateType?: ProfileTemplateType;
    // Password status for Super-Admin visibility
    passwordStatus?: string;
    plainPassword?: string;
    // Social media fields
    website?: string;
    github?: string;
    twitter?: string;
    instagram?: string;
    facebook?: string;
    // Business card fields
    phone?: string;
    mobile?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    company?: string;
    companyLogo?: string;
    position?: string;
    skills?: string[];
    // Additional profile data
    bio?: string;
    followersCount?: number;
    followingCount?: number;
    // Follower images for social media template
    followerImages?: FollowerImage[];
    // Social media links
    linkedin?: string;
    // Education
    education?: Education;
    // Work experience
    experience?: {
        position: string;
        company: string;
        startDate: string;
        endDate?: string;
        description: string;
    }[];
    token?: string;
}

export interface AccountUpdate {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: Role;
    password?: string;
    confirmPassword?: string;
    profileTemplateType?: ProfileTemplateType;
    profileImage?: string | null;
    companyLogo?: string | null;
    education?: Education;
    followerImages?: FollowerImage[];
}
