import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [items, setItems] = useState([]); // [{ productId, name, brand, price, quantity, maxStock, code }]

    const addItem = useCallback((product) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product.productId);
            if (existing) {
                return prev.map(i =>
                    i.productId === product.productId
                        ? { ...i, quantity: Math.min(i.quantity + 1, i.maxStock) }
                        : i
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    }, []);

    const removeItem = useCallback((productId) => {
        setItems(prev => prev.filter(i => i.productId !== productId));
    }, []);

    const updateQty = useCallback((productId, qty) => {
        if (qty <= 0) {
            setItems(prev => prev.filter(i => i.productId !== productId));
        } else {
            setItems(prev =>
                prev.map(i => i.productId === productId
                    ? { ...i, quantity: Math.min(qty, i.maxStock) }
                    : i
                )
            );
        }
    }, []);

    const clearCart = useCallback(() => setItems([]), []);

    const totalItems = items.reduce((s, i) => s + i.quantity, 0);
    const totalPrice = items.reduce((s, i) => s + i.quantity * i.price, 0);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
