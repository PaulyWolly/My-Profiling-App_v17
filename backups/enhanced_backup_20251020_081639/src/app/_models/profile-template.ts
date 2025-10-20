export enum ProfileTemplateType {
    STANDARD = 'STANDARD',
    BUSINESS_CARD = 'BUSINESS_CARD',
    SOCIAL_MEDIA = 'SOCIAL_MEDIA'
}

export interface ProfileTemplate {
    id: ProfileTemplateType;
    name: string;
    description: string;
    thumbnailUrl: string;
    previewUrl: string;
}

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
    {
        id: ProfileTemplateType.STANDARD,
        name: 'Standard Profile',
        description: 'Professional profile layout with user information, location, and social links',
        thumbnailUrl: 'assets/images/profile-templates/standard-template.png',
        previewUrl: 'assets/images/profile-templates/standard-template.png'
    },
    {
        id: ProfileTemplateType.BUSINESS_CARD,
        name: 'Business Card',
        description: 'Professional contact card-style layout with ratings and work information',
        thumbnailUrl: 'assets/images/profile-templates/business-card-template.png',
        previewUrl: 'assets/images/profile-templates/business-card-template.png'
    },
    {
        id: ProfileTemplateType.SOCIAL_MEDIA,
        name: 'Social Media',
        description: 'Twitter-inspired layout showing follower counts and connection information',
        thumbnailUrl: 'assets/images/profile-templates/social-media-template.png',
        previewUrl: 'assets/images/profile-templates/social-media-template.png'
    }
]; 