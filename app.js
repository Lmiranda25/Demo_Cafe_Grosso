import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// CONFIGURACIÓN FIREBASE (OPCIONAL - Sin Firebase funciona con localStorage)
let auth, db, appId;

// Inicializar window.app inmediatamente para evitar errores
window.app = window.app || {};

try {
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
    if (firebaseConfig) {
        const appInfo = initializeApp(firebaseConfig);
        auth = getAuth(appInfo);
        db = getFirestore(appInfo);
        appId = typeof __app_id !== 'undefined' ? __app_id : 'cafe-grosso-v1';
    }
} catch (e) {
    console.log('Firebase no configurado, usando localStorage');
}

// ESTADO GLOBAL
const state = {
    user: null,
    view: 'customer', // 'customer' | 'admin'
    cart: [],
    orderType: 'delivery', // 'delivery' | 'pickup'
    orders: [],
    categoryFilter: 'all'
};

// DATOS MENU (MOCK)
const MENU = [
    { id: 1, name: "Medialunas de Manteca", price: 8, cat: "panaderia", img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop", desc: "Clásicas argentinas. Docena S/. 90" },
    { id: 2, name: "Medialunas de Grasa", price: 7, cat: "panaderia", img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=300&fit=crop", desc: "Saladitas y crocantes. Ideales para el mate." },
    { id: 3, name: "Café con Leche + 3 Medialunas", price: 35, cat: "panaderia", img: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop", desc: "La promo clásica de la casa." },
    { id: 4, name: "Tostado Jamón y Queso", price: 18, cat: "salado", img: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop", desc: "En pan de miga triple, bien tostado." },
    { id: 5, name: "Empanada Carne Cuchillo", price: 12, cat: "salado", img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop", desc: "Jugosa, con aceituna, huevo y cebolla de verdeo." },
    { id: 6, name: "Empanada Jamón y Queso", price: 12, cat: "salado", img: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop", desc: "Mucho queso, masa hojaldrada casera." },
    { id: 7, name: "Milanesa Napolitana c/ Papas", price: 45, cat: "platos", img: "https://images.unsplash.com/photo-1612392062798-2537158f895b?w=400&h=300&fit=crop", desc: "Para compartir. Salsa casera y mucho queso." },
    { id: 8, name: "Submarino", price: 15, cat: "panaderia", img: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&h=300&fit=crop", desc: "Leche caliente con barra de chocolate Águila." },
    { id: 9, name: "Alfajor de Maicena XL", price: 10, cat: "panaderia", img: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=300&fit=crop", desc: "Con mucho dulce de leche y coco rallado." },
    { id: 10, name: "Matambre a la Pizza", price: 48, cat: "platos", img: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop", desc: "Tierno, con muzzarella y papas rejilla." },
    { id: 11, name: "Sándwich de Lomito", price: 38, cat: "platos", img: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop", desc: "Completo: lechuga, tomate, jamón, queso, huevo." },
    { id: 12, name: "Pastafrola de Membrillo", price: 14, cat: "panaderia", img: "https://images.unsplash.com/photo-1519915212116-7cfef71f1d3e?w=400&h=300&fit=crop", desc: "Porción generosa de la receta de la abuela." }
];

// FUNCIONES DE UI
window.app = {
    init: async () => {
        // Auth (opcional)
        try {
            if (auth) {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
                
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        state.user = user;
                        app.listenOrders();
                    }
                });
            } else {
                // Sin Firebase, usar localStorage
                state.user = { uid: 'local-user-' + Date.now() };
                // Cargar pedidos del localStorage
                const savedOrders = localStorage.getItem('cafe-orders');
                if (savedOrders) {
                    state.orders = JSON.parse(savedOrders);
                    app.renderAdminBoard();
                }
            }
        } catch (e) {
            console.log('Usando modo local sin Firebase');
            state.user = { uid: 'local-user-' + Date.now() };
        }

        app.renderMenu();
        lucide.createIcons();
    },

    // Navegación
    showHome: () => {
        document.getElementById('customer-view').classList.remove('hidden');
        document.getElementById('admin-view').classList.add('hidden');
        window.scrollTo(0,0);
    },
    
    toggleView: () => {
        const isAdmin = document.getElementById('admin-view').classList.contains('hidden');
        if (isAdmin) {
            const pass = prompt("Ingrese clave de Admin (cualquier cosa sirve en demo):");
            if(pass) {
                document.getElementById('customer-view').classList.add('hidden');
                document.getElementById('admin-view').classList.remove('hidden');
                state.view = 'admin';
            }
        } else {
            app.showHome();
        }
    },

    toggleCart: () => {
        const modal = document.getElementById('cart-modal');
        const isHidden = modal.classList.contains('hidden');
        if(isHidden) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            // Siempre empezar en el paso 1
            app.goToStep1();
        } else {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    goToStep1: () => {
        document.getElementById('cart-step-1').classList.remove('hidden');
        document.getElementById('cart-step-2').classList.add('hidden');
        lucide.createIcons();
    },

    goToStep2: () => {
        if(state.cart.length === 0) return;
        
        // Actualizar resumen en el paso 2
        const summaryEl = document.getElementById('order-summary');
        const total = state.cart.reduce((a,b) => a + (b.price * b.qty), 0);
        const totalStep2 = document.getElementById('cart-total-step2');
        
        summaryEl.innerHTML = state.cart.map(item => {
            return `<div class="flex justify-between py-1">
                <span>${item.qty}x ${item.name}</span>
                <span class="font-bold">S/. ${(item.price * item.qty).toFixed(2)}</span>
            </div>`;
        }).join('');
        
        totalStep2.innerText = `S/. ${total.toFixed(2)}`;
        
        document.getElementById('cart-step-1').classList.add('hidden');
        document.getElementById('cart-step-2').classList.remove('hidden');
        lucide.createIcons();
    },

    // Categorías
    filterCategory: (cat) => {
        state.categoryFilter = cat;
        
        // Actualizar botones UI
        document.querySelectorAll('.category-btn').forEach(btn => {
            if(btn.dataset.cat === cat) {
                btn.classList.remove('bg-transparent', 'border-stone-600', 'text-white');
                btn.classList.add('bg-amber-500', 'text-stone-900', 'border-transparent');
            } else {
                btn.classList.add('bg-transparent', 'border-stone-600', 'text-white');
                btn.classList.remove('bg-amber-500', 'text-stone-900', 'border-transparent');
                // Fix specific styles for 'all' button if needed, simpler logic:
                if(btn.dataset.cat === 'all' && cat !== 'all') {
                     btn.classList.remove('bg-amber-500', 'text-stone-900');
                     btn.classList.add('text-white', 'border-stone-600');
                }
            }
        });
        app.renderMenu();
    },

    // Renderizado
    renderMenu: () => {
        const grid = document.getElementById('menu-grid');
        grid.innerHTML = '';
        
        const filtered = state.categoryFilter === 'all' 
            ? MENU 
            : MENU.filter(i => i.cat === state.categoryFilter);

        filtered.forEach(item => {
            const el = document.createElement('div');
            el.className = 'bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col card-hover transition-all duration-300';
            el.innerHTML = `
                <div class="h-48 bg-stone-100 relative overflow-hidden">
                    <img src="${item.img}" alt="${item.name}" class="w-full h-full object-cover" loading="lazy">
                    <span class="absolute top-3 right-3 bg-amber-500 backdrop-blur text-stone-900 text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg border-2 border-white">S/. ${item.price}</span>
                </div>
                <div class="p-5 flex-1 flex flex-col">
                    <h3 class="font-bold text-lg text-stone-800 mb-1 leading-tight">${item.name}</h3>
                    <p class="text-stone-500 text-sm mb-4 flex-1">${item.desc}</p>
                    <button onclick="app.addToCart(${item.id})" class="w-full py-2.5 bg-stone-900 text-white rounded-lg font-bold text-sm hover:bg-amber-500 hover:text-stone-900 transition-all hover:shadow-lg flex items-center justify-center gap-2">
                        <i data-lucide="plus" class="w-4 h-4"></i> AGREGAR
                    </button>
                </div>
            `;
            grid.appendChild(el);
        });
        lucide.createIcons();
    },

    // Carrito
    addToCart: (id) => {
        const item = MENU.find(i => i.id === id);
        const existing = state.cart.find(i => i.id === id);
        
        if(existing) {
            existing.qty++;
        } else {
            state.cart.push({...item, qty: 1});
        }
        
        app.updateCartUI();
        
        // Animación simple de feedback
        const btn = document.querySelector(`button[onclick="app.addToCart(${id})"]`);
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> AGREGADO`;
        btn.classList.add('bg-green-600', 'text-white');
        lucide.createIcons();
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('bg-green-600');
        }, 1000);
    },

    removeFromCart: (id) => {
        state.cart = state.cart.filter(i => i.id !== id);
        app.updateCartUI();
    },

    changeQty: (id, delta) => {
        const item = state.cart.find(i => i.id === id);
        if(item) {
            item.qty += delta;
            if(item.qty <= 0) app.removeFromCart(id);
            else app.updateCartUI();
        }
    },

    updateCartUI: () => {
        const container = document.getElementById('cart-items');
        const badge = document.getElementById('cart-badge');
        const totalEl = document.getElementById('cart-total');
        const totalHeaderEl = document.getElementById('cart-total-header');
        const subtotalEl = document.getElementById('cart-subtotal');
        const btnGoStep2 = document.getElementById('btn-go-step2');
        
        // Badge y contadores
        const count = state.cart.reduce((a,b) => a + b.qty, 0);
        badge.innerText = count;
        badge.classList.toggle('hidden', count === 0);
        
        // Total
        const total = state.cart.reduce((a,b) => a + (b.price * b.qty), 0);
        totalEl.innerText = `S/. ${total.toFixed(2)}`;
        if (totalHeaderEl) totalHeaderEl.innerText = `S/. ${total.toFixed(2)}`;
        if (btnGoStep2) btnGoStep2.disabled = count === 0;

        // Subtotal tipo calculadora
        if(state.cart.length > 0 && subtotalEl) {
            subtotalEl.classList.remove('hidden');
            const subtotalHTML = state.cart.map(item => {
                const itemTotal = item.price * item.qty;
                return `
                    <div class="flex justify-between items-center text-stone-700">
                        <span class="text-xs">${item.qty}x ${item.name}</span>
                        <span class="font-bold">S/. ${itemTotal.toFixed(2)}</span>
                    </div>
                `;
            }).join('');
            subtotalEl.innerHTML = `
                <div class="space-y-2">
                    ${subtotalHTML}
                    <div class="border-t-2 border-dashed border-stone-300 pt-2 mt-2 flex justify-between items-center text-stone-900">
                        <span class="font-bold">SUBTOTAL:</span>
                        <span class="text-lg font-bold">S/. ${total.toFixed(2)}</span>
                    </div>
                </div>
            `;
        } else if (subtotalEl) {
            subtotalEl.classList.add('hidden');
        }

        // Items
        if(state.cart.length === 0) {
            container.innerHTML = `
                <div class="text-center text-stone-300 py-12 flex flex-col items-center">
                    <i data-lucide="shopping-basket" class="w-20 h-20 mb-4 opacity-20"></i>
                    <p class="text-xl font-bold text-stone-400">Carrito vacío</p>
                    <p class="text-sm text-stone-500">¡Agrega productos del menú!</p>
                </div>
            `;
        } else {
            container.innerHTML = state.cart.map(item => {
                const itemTotal = item.price * item.qty;
                return `
                <div class="bg-white border-2 border-stone-200 rounded-xl p-4 hover:border-amber-400 transition-all shadow-sm hover:shadow-md">
                    <div class="flex gap-4 items-start mb-3">
                        <img src="${item.img}" alt="${item.name}" class="w-20 h-20 rounded-lg object-cover shadow-sm">
                        <div class="flex-1">
                            <h4 class="font-bold text-base text-stone-900 mb-1">${item.name}</h4>
                            <p class="text-stone-500 text-sm">S/. ${item.price.toFixed(2)} c/u</p>
                            <p class="text-amber-600 font-bold text-lg mt-1">S/. ${itemTotal.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="flex items-center justify-between bg-stone-50 rounded-lg p-2 border border-stone-200">
                        <button onclick="app.changeQty(${item.id}, -1)" class="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-stone-600 hover:text-red-500 hover:bg-red-50 transition-all border border-stone-200">
                            <i data-lucide="minus" class="w-5 h-5"></i>
                        </button>
                        <div class="text-center px-4">
                            <span class="text-xs text-stone-500 block">Cantidad</span>
                            <span class="text-2xl font-bold text-stone-900">${item.qty}</span>
                        </div>
                        <button onclick="app.changeQty(${item.id}, 1)" class="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-stone-600 hover:text-green-500 hover:bg-green-50 transition-all border border-stone-200">
                            <i data-lucide="plus" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            `;
            }).join('');
        }
        lucide.createIcons();
    },

    setOrderType: (type) => {
        state.orderType = type;
        const btnDelivery = document.getElementById('btn-delivery');
        const btnPickup = document.getElementById('btn-pickup');
        const addrInput = document.getElementById('input-address');

        if(type === 'delivery') {
            btnDelivery.className = 'py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 border-amber-500 bg-amber-50 text-amber-900 transition-all';
            btnPickup.className = 'py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 border-stone-200 text-stone-500 hover:border-stone-300 transition-all';
            addrInput.classList.remove('hidden');
        } else {
            btnPickup.className = 'py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 border-amber-500 bg-amber-50 text-amber-900 transition-all';
            btnDelivery.className = 'py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 border-stone-200 text-stone-500 hover:border-stone-300 transition-all';
            addrInput.classList.add('hidden');
        }
        lucide.createIcons();
    },

    // Checkout
    checkout: async () => {
        if(!state.user) return;
        
        const name = document.getElementById('input-name').value;
        const address = document.getElementById('input-address').value;
        
        if(!name) return alert("Por favor ingresa tu nombre.");
        if(state.orderType === 'delivery' && !address) return alert("Por favor ingresa tu dirección.");

        const btn = document.getElementById('btn-checkout');
        btn.disabled = true;
        btn.innerText = "ENVIANDO...";

        try {
            const newOrder = {
                id: 'order-' + Date.now(),
                items: state.cart,
                total: state.cart.reduce((a,b) => a + (b.price * b.qty), 0),
                customerName: name,
                address: state.orderType === 'delivery' ? address : 'Retiro en Tienda',
                type: state.orderType,
                status: 'pending',
                timestamp: new Date().toISOString(),
                userId: state.user.uid
            };

            if (db && auth) {
                // Con Firebase
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
            } else {
                // Sin Firebase, usar localStorage
                state.orders.unshift(newOrder);
                localStorage.setItem('cafe-orders', JSON.stringify(state.orders));
                app.renderAdminBoard();
            }

            state.cart = [];
            app.updateCartUI();
            
            // Cerrar modal y resetear al paso 1
            app.toggleCart();
            
            alert(`¡Pedido confirmado! 🎉\n\nTotal: S/. ${newOrder.total.toFixed(2)}\n\nEn breve nos contactaremos contigo.`);
        } catch (e) {
            console.error(e);
            alert("Error al enviar pedido. Intente nuevamente.");
        }
        
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="w-6 h-6"></i> REALIZAR PEDIDO <i data-lucide="arrow-right" class="w-6 h-6"></i>';
        lucide.createIcons();
    },

    // Admin Logic
    listenOrders: () => {
        if(!state.user) return;
        
        if (db && auth) {
            // Con Firebase
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
                orderBy('timestamp', 'desc')
            );

            onSnapshot(q, (snapshot) => {
                const orders = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
                state.orders = orders;
                app.renderAdminBoard();
            }, (error) => {
                console.error("Error listening to orders:", error);
            });
        } else {
            // Sin Firebase, cargar de localStorage
            const savedOrders = localStorage.getItem('cafe-orders');
            if (savedOrders) {
                state.orders = JSON.parse(savedOrders);
                app.renderAdminBoard();
            }
        }
    },

    updateStatus: async (orderId, newStatus) => {
        try {
            if (db && auth) {
                // Con Firebase
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), {
                    status: newStatus
                });
            } else {
                // Sin Firebase, actualizar localStorage
                const order = state.orders.find(o => o.id === orderId);
                if (order) {
                    order.status = newStatus;
                    localStorage.setItem('cafe-orders', JSON.stringify(state.orders));
                    app.renderAdminBoard();
                }
            }
        } catch (e) {
            console.error("Error updating status:", e);
        }
    },

    renderAdminBoard: () => {
        const pending = state.orders.filter(o => o.status === 'pending');
        const preparing = state.orders.filter(o => o.status === 'preparing');
        const ready = state.orders.filter(o => o.status === 'ready');

        document.getElementById('count-pending').innerText = pending.length;
        document.getElementById('count-preparing').innerText = preparing.length;
        document.getElementById('count-ready').innerText = ready.length;

        const renderCard = (order, nextStatus, nextLabel, btnColor, showDelete = false) => {
            const itemsHtml = order.items.map(i => `<li class="text-xs text-stone-600 flex justify-between"><span>${i.qty}x ${i.name}</span></li>`).join('');
            const typeIcon = order.type === 'delivery' ? 'bike' : 'store';
            const typeColor = order.type === 'delivery' ? 'text-amber-600 bg-amber-100' : 'text-stone-600 bg-stone-200';
            
            return `
                <div class="bg-white p-3 rounded-lg shadow-sm border border-stone-200 slide-in">
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-bold text-stone-800 text-sm">#${order.id.slice(-4)}</span>
                        <span class="text-xs px-2 py-1 rounded-full flex items-center gap-1 font-bold uppercase ${typeColor}">
                            <i data-lucide="${typeIcon}" class="w-3 h-3"></i> ${order.type}
                        </span>
                    </div>
                    <div class="mb-2">
                        <p class="font-bold text-sm truncate">${order.customerName}</p>
                        <p class="text-xs text-stone-500 truncate">${order.address}</p>
                    </div>
                    <ul class="mb-3 border-t border-b border-dashed border-stone-200 py-2 space-y-1">
                        ${itemsHtml}
                    </ul>
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-stone-900">S/. ${order.total.toFixed(2)}</span>
                        <div class="flex gap-1">
                            ${nextStatus ? `
                                <button onclick="app.updateStatus('${order.id}', '${nextStatus}')" class="px-3 py-1.5 ${btnColor} text-white text-xs font-bold rounded-md shadow-sm hover:opacity-90 transition-opacity">
                                    ${nextLabel}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        };

        document.getElementById('orders-pending').innerHTML = pending.map(o => renderCard(o, 'preparing', 'COCINAR', 'bg-blue-600')).join('');
        document.getElementById('orders-preparing').innerHTML = preparing.map(o => renderCard(o, 'ready', 'LISTO', 'bg-green-600')).join('');
        document.getElementById('orders-ready').innerHTML = ready.map(o => renderCard(o, null, null, null)).join('');
        
        lucide.createIcons();
    }
};

// INICIAR
app.init();
