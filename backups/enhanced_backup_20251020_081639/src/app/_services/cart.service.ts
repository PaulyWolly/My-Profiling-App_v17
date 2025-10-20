import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Cart, CartItem } from '../_models/cart';

@Injectable({
    providedIn: 'root'
})
export class CartService {
    private cartKey = 'shopping_cart';
    private initialCart: Cart = {
        items: [],
        totalItems: 0,
        totalPrice: 0
    };

    private cartSubject = new BehaviorSubject<Cart>(this.initialCart);
    public cart$: Observable<Cart> = this.cartSubject.asObservable();

    constructor() {
        this.loadCart();
    }

    private loadCart(): void {
        const savedCart = localStorage.getItem(this.cartKey);
        if (savedCart) {
            this.cartSubject.next(JSON.parse(savedCart));
        }
    }

    private saveCart(cart: Cart): void {
        localStorage.setItem(this.cartKey, JSON.stringify(cart));
        this.cartSubject.next(cart);
    }

    private calculateTotals(cart: Cart): Cart {
        cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
        cart.totalPrice = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
        return cart;
    }

    addToCart(item: CartItem): void {
        const currentCart = this.cartSubject.value;
        const existingItemIndex = currentCart.items.findIndex(i => i.id === item.id);

        if (existingItemIndex > -1) {
            currentCart.items[existingItemIndex].quantity += item.quantity;
        } else {
            currentCart.items.push({ ...item });
        }

        this.saveCart(this.calculateTotals(currentCart));
    }

    removeFromCart(itemId: string): void {
        const currentCart = this.cartSubject.value;
        currentCart.items = currentCart.items.filter(item => item.id !== itemId);
        this.saveCart(this.calculateTotals(currentCart));
    }

    updateQuantity(itemId: string, quantity: number): void {
        const currentCart = this.cartSubject.value;
        const itemIndex = currentCart.items.findIndex(item => item.id === itemId);
        
        if (itemIndex > -1) {
            if (quantity <= 0) {
                this.removeFromCart(itemId);
                return;
            }
            currentCart.items[itemIndex].quantity = quantity;
            this.saveCart(this.calculateTotals(currentCart));
        }
    }

    clearCart(): void {
        this.saveCart(this.initialCart);
    }

    getCart(): Cart {
        return this.cartSubject.value;
    }
} 