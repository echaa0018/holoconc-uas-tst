const API_URL = 'https://marine.theokaitou.my.id';
// Partner API for Pia Arena MM Exclusive
const PARTNER_API_URL = 'https://ngofee.theokaitou.my.id/api/drinks/top/expensive';

let allConcerts = [];
let myOrders = [];
let token = localStorage.getItem('token');
let partnerDrinksCache = []; 

// Variables for Transaction Logic
let pendingConcert = null;
let pendingAmount = 0;

// Elements
const concertView = document.getElementById('concert-view');
const orderView = document.getElementById('order-view');
const orderTableBody = document.getElementById('order-table-body');
const noOrdersMsg = document.getElementById('no-orders-msg');
const searchInput = document.getElementById('search-input');
const loginModal = document.getElementById('login-modal');
const confirmModal = document.getElementById('confirm-modal');
const pageTitle = document.getElementById('page-title');
const navHome = document.getElementById('nav-home');
const navOrders = document.getElementById('nav-orders');
const toast = document.getElementById('toast');

// NEW Elements for Venue Exclusive
const venueBonusContainer = document.getElementById('venue-bonus-container');
const bonusSelectionArea = document.getElementById('bonus-selection-area'); // New Container
const bonusQtyDisplay = document.getElementById('bonus-qty-display');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        showLoginModal();
    } else {
        fetchConcerts();
    }

    navHome.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav('home');
        fetchConcerts();
    });

    navOrders.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveNav('orders');
        fetchMyTickets();
    });

    document.getElementById('nav-logout').addEventListener('click', handleLogout);
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('btn-cancel-buy').addEventListener('click', closeConfirmModal);
    document.getElementById('btn-confirm-buy').addEventListener('click', executePurchase);

    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        
        if (navHome.classList.contains('active')) {
            const filtered = allConcerts.filter(c => 
                c.name.toLowerCase().includes(keyword) || 
                c.artist.toLowerCase().includes(keyword)
            );
            renderConcerts(filtered);
        } else {
            const filtered = myOrders.filter(o => 
                o.Concert.name.toLowerCase().includes(keyword) || 
                o.Concert.artist.toLowerCase().includes(keyword)
            );
            renderOrders(filtered);
        }
    });
});

function setActiveNav(view) {
    if (view === 'home') {
        navHome.classList.add('active');
        navOrders.classList.remove('active');
        pageTitle.innerText = "Upcoming Concerts";
        concertView.style.display = 'grid';
        orderView.style.display = 'none';
        searchInput.placeholder = "Search artist or concert...";
    } else {
        navHome.classList.remove('active');
        navOrders.classList.add('active');
        pageTitle.innerText = "My Ticket History";
        concertView.style.display = 'none';
        orderView.style.display = 'block';
        searchInput.placeholder = "Search history...";
        searchInput.value = '';
    }
}

function showToast(message) {
    toast.innerText = message;
    toast.className = "toast show";
    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
    }, 3000);
}

function adjustQty(id, change) {
    const input = document.getElementById(`qty-${id}`);
    let currentValue = parseInt(input.value);
    let newValue = currentValue + change;

    if (newValue > 2) {
        showToast("Maximum purchase is 2 tickets per account for this concert!");
        return;
    }
    
    if (newValue >= 1) {
        input.value = newValue;
    }
}

function getArtistImage(artistName) {
    const filename = artistName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `./images/${filename}.jpg`;
}

// --- HELPER FUNCTIONS FOR DRINKS ---
async function fetchPartnerDrinks() {
    if (partnerDrinksCache.length > 0) return;

    try {
        const res = await fetch(PARTNER_API_URL);
        const json = await res.json();
        
        if (json.status === 'success' && Array.isArray(json.data)) {
            partnerDrinksCache = json.data;
            // Refill dropdowns if they are currently empty/waiting
            renderDrinkDropdowns(); 
        }
    } catch (err) {
        console.error("Failed to fetch partner drinks:", err);
        bonusSelectionArea.innerHTML = '<p style="color:red">Failed to load drinks</p>';
    }
}

function renderDrinkDropdowns() {
    // Clear existing
    bonusSelectionArea.innerHTML = '';
    
    // Create 'pendingAmount' number of dropdowns
    for (let i = 1; i <= pendingAmount; i++) {
        const wrapper = document.createElement('div');
        
        const label = document.createElement('label');
        label.innerText = `Ticket #${i} Drink:`;
        label.style.fontSize = "0.85rem";
        label.style.color = "#ccc";
        
        const select = document.createElement('select');
        select.className = 'bonus-drink-select'; // Helper class for gathering values
        select.style.width = "100%";
        select.style.padding = "10px";
        select.style.background = "#333";
        select.style.color = "white";
        select.style.border = "1px solid #555";
        select.style.borderRadius = "5px";

        // Default Option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = "";
        defaultOpt.innerText = "Select a drink...";
        defaultOpt.disabled = true;
        defaultOpt.selected = true;
        select.appendChild(defaultOpt);

        // Populate options
        partnerDrinksCache.forEach(drink => {
            const option = document.createElement('option');
            option.value = drink.id;
            option.textContent = `${drink.name} (Top Tier)`;
            select.appendChild(option);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        bonusSelectionArea.appendChild(wrapper);
    }
}

// --- FETCH DATA ---
async function fetchConcerts() {
    try {
        const res = await fetch(`${API_URL}/concerts`);
        const data = await res.json();
        allConcerts = data;
        renderConcerts(allConcerts);
    } catch (err) {
        console.error("Failed to fetch concerts", err);
    }
}

async function fetchMyTickets() {
    try {
        const res = await fetch(`${API_URL}/my-orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.message && !Array.isArray(data)) {
            myOrders = [];
        } else {
            myOrders = data;
        }
        renderOrders(myOrders);
    } catch (err) {
        console.error("Failed to fetch orders", err);
    }
}

// --- RENDER FUNCTIONS ---
function renderConcerts(concerts) {
    concertView.innerHTML = '';
    
    if (concerts.length === 0) {
        concertView.innerHTML = '<p style="text-align:center; color:#888;">No concerts found.</p>';
        return;
    }

    concerts.forEach(concert => {
        const dateObj = new Date(concert.date);
        const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        const imageUrl = getArtistImage(concert.artist);
        const fallbackUrl = `https://placehold.co/600x400/222/FFF?text=${encodeURIComponent(concert.artist)}`;

        const card = document.createElement('div');
        card.className = 'card';
        card.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.9)), url('${imageUrl}'), url('${fallbackUrl}')`;

        card.innerHTML = `
            <h3>${concert.name}</h3>
            <p class="artist">${concert.artist}</p>
            <div class="card-details">
                <p>📍 ${concert.venue}</p>
                <p>📅 ${dateString}</p>
                <p>Stock: ${concert.stock}</p>
            </div>
            <div class="price">$${concert.price}</div>
            <div class="card-actions">
                 <div class="qty-selector">
                    <button class="qty-btn" onclick="adjustQty(${concert.id}, -1)">−</button>
                    <input type="number" min="1" max="2" value="1" class="qty-input-custom" id="qty-${concert.id}" readonly>
                    <button class="qty-btn" onclick="adjustQty(${concert.id}, 1)">+</button>
                </div>
                <button class="btn-primary" onclick="initiateBuy(${concert.id})">Buy Ticket</button>
            </div>
        `;
        concertView.appendChild(card);
    });
}

function renderOrders(orders) {
    orderTableBody.innerHTML = '';

    if (!orders || orders.length === 0) {
        document.querySelector('.ticket-table').style.display = 'none';
        noOrdersMsg.style.display = 'block';
        return;
    } else {
        document.querySelector('.ticket-table').style.display = 'table';
        noOrdersMsg.style.display = 'none';
    }

    orders.forEach(order => {
        const c = order.Concert;
        const dateObj = new Date(c.date);
        const dateString = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color: #00d4ff; font-weight:bold;">${dateString}</td>
            <td>${c.name}</td>
            <td style="font-style:italic;">${c.artist}</td>
            <td>${c.venue}</td>
            <td style="text-align:center;">${order.amount}</td>
            <td style="color: #00e676; font-weight:bold;">$${order.totalPrice}</td>
        `;
        orderTableBody.appendChild(row);
    });
}

// --- AUTH & TRANSACTION LOGIC ---
async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            loginModal.style.display = 'none';
            fetchConcerts();
        } else {
            document.getElementById('login-error').innerText = data.message || 'Login failed';
        }
    } catch (err) {
        console.error(err);
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    location.reload();
}

function showLoginModal() {
    loginModal.style.display = 'flex';
}

function initiateBuy(concertId) {
    const qtyInput = document.getElementById(`qty-${concertId}`);
    const amount = parseInt(qtyInput.value);
    
    const concert = allConcerts.find(c => c.id === concertId);
    if (!concert) return;

    pendingConcert = concert;
    pendingAmount = amount;
    const totalPrice = concert.price * amount;

    // CHECK FOR PIA ARENA MM
    if (concert.venue === "Pia Arena MM") {
        if(venueBonusContainer) venueBonusContainer.style.display = 'block';
        if(bonusQtyDisplay) bonusQtyDisplay.innerText = amount;
        
        // Populate Inputs
        if (partnerDrinksCache.length === 0) {
            fetchPartnerDrinks(); // This will call renderDrinkDropdowns on success
        } else {
            renderDrinkDropdowns(); // Use cached data
        }
    } else {
        if(venueBonusContainer) venueBonusContainer.style.display = 'none';
    }

    const detailsDiv = document.getElementById('confirm-details');
    detailsDiv.innerHTML = `
        <p><strong>Concert:</strong> ${concert.name}</p>
        <p><strong>Artist:</strong> ${concert.artist}</p>
        <p><strong>Venue:</strong> ${concert.venue}</p>
        <p><strong>Quantity:</strong> ${amount} ticket(s)</p>
        <hr style="margin: 10px 0; border-color: #444;">
        <p style="font-size: 1.2rem; color: #ffeb3b;"><strong>Total: $${totalPrice}</strong></p>
    `;

    confirmModal.style.display = 'flex';
}

function closeConfirmModal() {
    confirmModal.style.display = 'none';
    pendingConcert = null;
    pendingAmount = 0;
}

// --- UPDATED EXECUTE PURCHASE ---
async function executePurchase() {
    if (!pendingConcert) return;

    let selectedDrinks = [];
    
    // If Pia Arena MM, gather all selected drinks
    if (pendingConcert.venue === "Pia Arena MM") {
        const dropdowns = document.querySelectorAll('.bonus-drink-select');
        
        // Validate all are selected
        for (let i = 0; i < dropdowns.length; i++) {
            if (!dropdowns[i].value) {
                alert(`Please select a drink for Ticket #${i+1}!`);
                return;
            }
            // Find name from cache
            const drinkId = dropdowns[i].value;
            const drinkObj = partnerDrinksCache.find(d => d.id == drinkId);
            selectedDrinks.push(drinkObj ? drinkObj.name : "Unknown");
        }
    }

    // SPINNER LOGIC
    const btnConfirm = document.getElementById('btn-confirm-buy');
    const originalText = btnConfirm.innerHTML;
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const payload = { 
            concertId: pendingConcert.id, 
            amount: pendingAmount
        };

        if (selectedDrinks.length > 0) {
            // Send as comma-separated string to backend
            payload.bonusDrink = selectedDrinks.join(", ");
        }

        const res = await fetch(`${API_URL}/buy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            closeConfirmModal();
            let msg = 'Purchase successful! See "My Tickets" for details.';
            if (selectedDrinks.length > 0) {
                msg += `\n\nBonus Drinks Added:\n- ${selectedDrinks.join("\n- ")}`;
            }
            alert(msg);
            fetchConcerts(); 
        } else {
            alert('Failed: ' + data.message);
            closeConfirmModal(); 
        }
    } catch (err) {
        alert('Error processing request');
        console.error(err);
        closeConfirmModal();
    } finally {
        // Restore button state
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = originalText;
    }
}