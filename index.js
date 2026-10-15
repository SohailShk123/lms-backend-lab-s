const express = require('express'); 
const mongoose = require('mongoose'); 

const app = express(); 
app.use(express.json()); 

// 🚀 VERCEL SERVERLESS DB CONNECTION LOGIC
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  try {
    const MONGO_URI = process.env.MONGO_URI; 
    if (!MONGO_URI) throw new Error("MONGO_URI is missing!");
    const db = await mongoose.connect(MONGO_URI);
    isConnected = db.connections[0].readyState === 1;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
};

// License Schema 
const LicenseSchema = new mongoose.Schema({ 
  labId: { type: String, required: true, unique: true }, 
  labName: String, 
  expiryDate: String, 
  working: { type: Boolean, default: true } 
}); 
const License = mongoose.models.License || mongoose.model('License', LicenseSchema); 

app.get('/', (req, res) => {
  res.send("🚀 LIMS Licensing Server is RUNNING Successfully!");
});

// ----------------------------------------------------
// 🛡️ SUPER ADMIN DASHBOARD UI
// ----------------------------------------------------
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LIMS Super Admin</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen font-sans text-gray-800">
      
      <!-- 🔒 LOGIN SCREEN -->
      <div id="loginScreen" class="flex items-center justify-center min-h-screen">
        <div class="bg-white p-8 rounded-xl shadow-2xl w-96 text-center">
          <h2 class="text-2xl font-black text-blue-700 mb-2">Admin Login</h2>
          <p class="text-gray-500 mb-6 text-sm">Enter secret key to manage labs</p>
          <input type="password" id="secretInput" placeholder="Enter Secret Key" class="w-full p-3 border rounded-lg outline-none focus:border-blue-500 text-center mb-4">
          <button onclick="login()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">Unlock Dashboard</button>
          <p id="loginError" class="text-red-500 text-sm mt-3 font-bold hidden"></p>
        </div>
      </div>

      <!-- 🎛️ MAIN DASHBOARD (Hidden by default) -->
      <div id="mainDashboard" class="hidden max-w-5xl mx-auto py-10 px-4">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-black text-blue-700">LIMS Admin Control</h1>
          <button onclick="logout()" class="text-sm font-bold text-red-600 hover:underline">Logout</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <!-- Add New Lab Form -->
          <div class="bg-white p-6 rounded-xl shadow-lg h-fit">
            <h2 class="text-xl font-bold mb-4">Add New Lab</h2>
            <form id="licenseForm" class="flex flex-col gap-4">
              <div>
                <label class="text-sm font-bold text-gray-700">Lab ID (Sequence)</label>
                <input type="text" id="labId" placeholder="e.g. LAB_001" required class="w-full p-2 border rounded outline-none focus:border-blue-500 uppercase mt-1">
              </div>
              <div>
                <label class="text-sm font-bold text-gray-700">Lab Name</label>
                <input type="text" id="labName" placeholder="e.g. City Path Lab" required class="w-full p-2 border rounded outline-none focus:border-blue-500 mt-1">
              </div>
              <div>
                <label class="text-sm font-bold text-gray-700">Expiry Date</label>
                <input type="date" id="expiryDate" required class="w-full p-2 border rounded outline-none focus:border-blue-500 mt-1">
              </div>
              <button type="submit" class="bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 mt-2">
                Create Lab License
              </button>
            </form>
            <div id="formMsg" class="mt-3 text-center font-bold text-sm hidden"></div>
          </div>

          <!-- Labs List Table -->
          <div class="bg-white p-6 rounded-xl shadow-lg md:col-span-2 overflow-x-auto">
            <h2 class="text-xl font-bold mb-4">Registered Labs</h2>
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-gray-100 text-gray-600 text-sm uppercase">
                  <th class="p-3 border-b">Lab ID</th>
                  <th class="p-3 border-b">Lab Name</th>
                  <th class="p-3 border-b">Expiry</th>
                  <th class="p-3 border-b text-center">App Access (ON/OFF)</th>
                </tr>
              </thead>
              <tbody id="labsTableBody">
                <!-- Rows will be injected by JS -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <script>
        let adminSecret = '';

        async function login() {
          const input = document.getElementById('secretInput').value;
          if(!input) return;
          
          adminSecret = input;
          const success = await fetchLabs();
          
          if(success) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainDashboard').style.display = 'block';
          } else {
            const err = document.getElementById('loginError');
            err.innerText = "❌ Incorrect Password!";
            err.style.display = 'block';
          }
        }

        function logout() {
          adminSecret = '';
          document.getElementById('secretInput').value = '';
          document.getElementById('mainDashboard').style.display = 'none';
          document.getElementById('loginScreen').style.display = 'flex';
          document.getElementById('loginError').style.display = 'none';
        }

        async function fetchLabs() {
          try {
            const res = await fetch('/api/admin/get-all', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adminSecret })
            });
            const data = await res.json();
            
            if(res.ok) {
              renderTable(data.licenses);
              return true;
            }
            return false;
          } catch (e) {
            return false;
          }
        }

        function renderTable(licenses) {
          const tbody = document.getElementById('labsTableBody');
          tbody.innerHTML = '';
          
          licenses.forEach(lab => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50 transition';
            
            // Toggle Button HTML
            const toggleHtml = lab.working 
              ? \`<button onclick="toggleStatus('\${lab.labId}', false)" class="bg-green-500 text-white px-4 py-1 rounded-full font-bold text-xs w-20 shadow-md">ON</button>\`
              : \`<button onclick="toggleStatus('\${lab.labId}', true)" class="bg-red-500 text-white px-4 py-1 rounded-full font-bold text-xs w-20 shadow-md">OFF</button>\`;

            row.innerHTML = \`
              <td class="p-3 font-bold text-blue-700">\${lab.labId}</td>
              <td class="p-3 font-semibold">\${lab.labName}</td>
              <td class="p-3 text-sm text-gray-500">\${lab.expiryDate}</td>
              <td class="p-3 text-center">\${toggleHtml}</td>
            \`;
            tbody.appendChild(row);
          });
        }

        async function toggleStatus(labId, newStatus) {
          try {
            await fetch('/api/admin/toggle-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ labId, working: newStatus, adminSecret })
            });
            fetchLabs(); // Refresh list automatically
          } catch(e) {
            alert("Network Error!");
          }
        }

        // Add new Lab
        document.getElementById('licenseForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const msgBox = document.getElementById('formMsg');
          msgBox.className = "mt-3 text-blue-600 font-bold block";
          msgBox.innerText = "Creating...";

          const payload = {
            labId: document.getElementById('labId').value.toUpperCase(),
            labName: document.getElementById('labName').value,
            expiryDate: document.getElementById('expiryDate').value,
            working: true, // Hamesha ON rahega new lab ke liye
            adminSecret: adminSecret
          };

          const res = await fetch('/api/admin/upsert-license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if(res.ok) {
            msgBox.className = "mt-3 text-green-600 font-bold block";
            msgBox.innerText = "✅ Created Successfully!";
            document.getElementById('licenseForm').reset();
            fetchLabs(); // Table update karo
          } else {
            msgBox.className = "mt-3 text-red-600 font-bold block";
            msgBox.innerText = "❌ Failed!";
          }
          
          setTimeout(() => msgBox.style.display = 'none', 3000);
        });
      </script>
    </body>
    </html>
  `);
});

// ----------------------------------------------------
// ⚙️ API ROUTES 
// ----------------------------------------------------

// 1. App se Check License
app.post('/api/check-license', async (req, res) => { 
  try { 
    await connectDB(); 
    const { labId } = req.body; 
    if (!labId) return res.status(400).json({ error: 'Lab ID is required' }); 
    
    let license = await License.findOne({ labId }); 
    if (!license) return res.json({ working: false, message: 'Lab not registered on cloud' }); 
    
    const today = new Date().toISOString().split('T')[0]; 
    if (today > license.expiryDate) { 
      license.working = false; 
      await license.save(); 
    } 
    res.json({ working: license.working, expiryDate: license.expiryDate, labName: license.labName }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  } 
}); 

// 2. Add New Lab from Dashboard
app.post('/api/admin/upsert-license', async (req, res) => { 
  try { 
    await connectDB();
    const { labId, labName, expiryDate, working, adminSecret } = req.body; 
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') return res.status(401).json({ error: 'Unauthorized' }); 
    
    const updated = await License.findOneAndUpdate( 
      { labId }, { labName, expiryDate, working }, { upsert: true, new: true } 
    ); 
    res.json({ success: true, updated }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  } 
}); 

// 3. Get All Labs for Dashboard Table
app.post('/api/admin/get-all', async (req, res) => {
  try {
    await connectDB();
    const { adminSecret } = req.body;
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') return res.status(401).json({ error: 'Unauthorized' }); 
    
    const licenses = await License.find().sort({ _id: -1 }); // Latest sabse upar
    res.json({ success: true, licenses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Toggle ON/OFF Status
app.post('/api/admin/toggle-status', async (req, res) => {
  try {
    await connectDB();
    const { labId, working, adminSecret } = req.body;
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') return res.status(401).json({ error: 'Unauthorized' }); 

    await License.findOneAndUpdate({ labId }, { working });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

const PORT = process.env.PORT || 3000; 
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}