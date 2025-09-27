export interface TimelinePost {
  id: string;
  author: string;
  authorImage: string;
  date: string;
  content: string;
}

export interface UserProfile {
  id: string;
  name: string;
  title: string;
  imageUrl: string;
  location: string;
  rating: number;
  phone: string;
  email: string;
  website: string;
  address: string;
  skills: string[];
  timeline: TimelinePost[];
} 