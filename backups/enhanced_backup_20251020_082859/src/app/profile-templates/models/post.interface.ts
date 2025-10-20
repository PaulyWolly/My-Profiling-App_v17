export interface Post {
  id: number;
  userId: number;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  author: {
    name: string;
    avatar: string;
    title?: string;
  };
} 