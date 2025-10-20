export interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
}

export interface Cart {
    items: CartItem[];
    totalItems: number;
    totalPrice: number;
} 