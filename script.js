/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const apiUrl = "https://chatbot-worker.amelie-garcia530.workers.dev/";

// Get reference to the Generate Routine button (matches index.html)
const generateRoutineBtn = document.getElementById("generateRoutine");

/* Store selected products in an array */
// Try to load selected products from localStorage, or start with an empty array
let selectedProducts = [];
const SELECTED_PRODUCTS_KEY = "selectedProducts";

// Helper: Save selected products to localStorage
function saveSelectedProducts() {
  localStorage.setItem(SELECTED_PRODUCTS_KEY, JSON.stringify(selectedProducts));
}

// Helper: Load selected products from localStorage
function loadSelectedProductsFromStorage() {
  const data = localStorage.getItem(SELECTED_PRODUCTS_KEY);
  if (data) {
    try {
      selectedProducts = JSON.parse(data);
    } catch {
      selectedProducts = [];
    }
  }
}

// Call this at the start to restore selections
loadSelectedProductsFromStorage();

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  // Show product cards, highlighting selected ones
  productsContainer.innerHTML = products
    .map((product) => {
      // Check if product is selected
      const isSelected = selectedProducts.some((p) => p.name === product.name);
      return `
    <div class="product-card${
      isSelected ? " selected" : ""
    }" data-product-name="${product.name}" tabindex="0">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <div class="product-description-card">
        ${
          product.description
            ? product.description
            : "No description available."
        }
      </div>
    </div>
  `;
    })
    .join("");

  // Add click event listeners to each product card
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const productName = card.getAttribute("data-product-name");
      const product = products.find((p) => p.name === productName);

      // Toggle selection
      const index = selectedProducts.findIndex((p) => p.name === productName);
      if (index === -1) {
        // Add to selected
        selectedProducts.push(product);
      } else {
        // Remove from selected
        selectedProducts.splice(index, 1);
      }
      saveSelectedProducts();
      // Update UI
      displayProducts(products);
      updateSelectedProductsList();
    });
  });
}

/* Update the Selected Products section */
function updateSelectedProductsList() {
  // Save current selection to localStorage
  saveSelectedProducts();

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected yet.</div>`;
    // Remove Clear All button if present
    const clearBtn = document.getElementById("clearAllBtn");
    if (clearBtn) clearBtn.remove();
    return;
  }
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product, idx) => `
      <div class="selected-product-item" data-index="${idx}">
        <span>${product.name}</span>
        <button class="selected-product-remove" title="Remove" aria-label="Remove ${product.name}">&times;</button>
      </div>
    `
    )
    .join("");

  // Add event listeners for remove buttons
  const removeBtns = selectedProductsList.querySelectorAll(
    ".selected-product-remove"
  );
  removeBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering card click
      const item = btn.closest(".selected-product-item");
      const idx = Number(item.getAttribute("data-index"));
      selectedProducts.splice(idx, 1);
      saveSelectedProducts();
      // Refresh both product grid and selected list
      const selectedCategory = categoryFilter.value;
      if (selectedCategory) {
        loadProducts().then((products) => {
          const filteredProducts = products.filter(
            (product) => product.category === selectedCategory
          );
          displayProducts(filteredProducts);
        });
      }
      updateSelectedProductsList();
    });
  });

  // Add "Clear All" button above the Generate Routine button if not present
  if (!document.getElementById("clearAllBtn")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "clearAllBtn";
    clearBtn.textContent = "Clear All";
    clearBtn.type = "button";
    clearBtn.className = "clear-all-btn";
    clearBtn.onclick = () => {
      if (
        confirm(
          "Are you sure you want to remove all selected products? This cannot be undone."
        )
      ) {
        selectedProducts = [];
        saveSelectedProducts();
        // Refresh product grid if a category is selected
        const selectedCategory = categoryFilter.value;
        if (selectedCategory) {
          loadProducts().then((products) => {
            const filteredProducts = products.filter(
              (product) => product.category === selectedCategory
            );
            displayProducts(filteredProducts);
          });
        }
        updateSelectedProductsList();
      }
    };
    // Insert the button after the selectedProductsList and before the generateRoutineBtn
    const parent = selectedProductsList.parentNode;
    parent.insertBefore(clearBtn, generateRoutineBtn);
  }
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

// Helper: Show a loading message in the chat window
function showLoading(message = "Loading...") {
  chatWindow.innerHTML = `<div class="placeholder-message">${message}</div>`;
}

// Store chat history for follow-up questions
let chatHistory = [];

// Helper: Render chat history in the chat window
function renderChat() {
  // Only show messages after the initial routine request
  // The first message in chatHistory is the routine request, so we skip it
  let messagesToShow = chatHistory;

  // If the first message is the initial routine request, skip it
  if (
    messagesToShow.length > 0 &&
    messagesToShow[0].content &&
    messagesToShow[0].content.includes("Here are the selected products as JSON")
  ) {
    messagesToShow = messagesToShow.slice(1);
  }

  chatWindow.innerHTML = messagesToShow
    .map((msg) => {
      if (msg.role === "user") {
        return `<div class="chat-message user"><strong>You:</strong> ${msg.content}</div>`;
      } else {
        return `<div class="chat-message ai"><strong>AI:</strong> ${msg.content}</div>`;
      }
    })
    .join("");
}

// Generate Routine button click handler
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = `<div class="placeholder-message">Please select at least one product to generate a routine.</div>`;
    return;
  }

  // Prepare product data for the API (only name, brand, category, description)
  const productsForRoutine = selectedProducts.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description || "",
  }));

  // Add user message to chat history
  const userMsg = `Here are the selected products as JSON: ${JSON.stringify(
    productsForRoutine
  )}. Generate a personalized routine using these products.`;
  chatHistory = [{ role: "user", content: userMsg }];
  renderChat();
  showLoading("Generating your routine...");

  // Prepare OpenAI API request
  const openaiPayload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful beauty expert. Generate a clear, step-by-step routine using the provided products. Only discuss skincare, haircare, makeup, fragrance, or related topics. Do not include who the products are from when naming products picked by the user.",
      },
      ...chatHistory,
    ],
    max_tokens: 1000,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(openaiPayload),
    });
    const data = await response.json();
    const aiMsg =
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content
        : "Sorry, I couldn't generate a routine right now.";
    chatHistory.push({ role: "assistant", content: aiMsg });
    renderChat();
  } catch (err) {
    chatWindow.innerHTML = `<div class="placeholder-message">Error: ${err.message}</div>`;
  }
});

// Chat form submission handler for follow-up questions
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = chatForm.querySelector("input, textarea");
  const userText = input.value.trim();
  if (!userText) return;

  // Add user message to chat history
  chatHistory.push({ role: "user", content: userText });
  renderChat();
  showLoading("Thinking...");

  // Prepare OpenAI API request with full chat history
  const openaiPayload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful beauty expert. Only answer questions about the generated routine, skincare, haircare, makeup, fragrance, or related topics. Do not include who the products are from when naming products picked by the user.",
      },
      ...chatHistory,
    ],
    max_tokens: 1000,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(openaiPayload),
    });
    const data = await response.json();
    const aiMsg =
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content
        : "Sorry, I couldn't get a response right now.";
    chatHistory.push({ role: "assistant", content: aiMsg });
    renderChat();
  } catch (err) {
    chatWindow.innerHTML = `<div class="placeholder-message">Error: ${err.message}</div>`;
  }

  input.value = "";
});

// Show initial selected products list (restores from localStorage)
updateSelectedProductsList();
