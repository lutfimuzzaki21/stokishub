import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [items, setItems] = useState([]); // [{ productId, name, brand, code, price, quantity, maxStock, packagingId?, packagingName?, unitQty? }]

    const addItem = useCallback((product) => {
        setItems(prev => {
            // Unique key = productId + packagingId (so same product in different packagings are separate cart lines)
            const existing = prev.find(i => i.productId === product.productId && i.packagingId === product.packagingId);
            if (existing) {
                return prev.map(i =>
                    (i.productId === product.productId && i.packagingId === product.packagingId)
                        ? { ...i, quantity: Math.min(i.quantity + 1, i.maxStock) }
                        : i
                );
            }
            return [...prev, { ...product, quantity: product.quantity || 1 }];
        });
    }, []);

    const removeItem = useCallback((productId, packagingId = undefined) => {
        setItems(prev => prev.filter(i => !(i.productId === productId && i.packagingId === packagingId)));
    }, []);

    const updateQty = useCallback((productId, qty, packagingId = undefined) => {
        if (qty <= 0) {
            setItems(prev => prev.filter(i => !(i.productId === productId && i.packagingId === packagingId)));
        } else {
            setItems(prev =>
                prev.map(i => (i.productId === productId && i.packagingId === packagingId)
                    ? { ...i, quantity: Math.min(qty, i.maxStock) }
                    : i
                )
            );
        }
    }, []);

    const clearCart = useCallback(() => setItems([]), []);

    const totalItems = items.reduce((s, i) => s + i.quantity, 0);
    const totalUnits = items.reduce((s, i) => s + i.quantity * (i.unitQty || 1), 0);
    const totalPrice = items.reduce((s, i) => s + i.quantity * i.price, 0);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalUnits, totalPrice }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
