import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Role, TransactionType, Product, Category, Type, Transaction, User } from './types';
import { INITIAL_CATEGORIES, INITIAL_TYPES, Icons } from './constants';
import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  increment
} from "firebase/firestore";

/**
 * KOMPONEN INTERNAL: BarcodeRenderer
 * Ditempatkan di sini untuk menjamin build Vercel sukses tanpa masalah pathing.
 */
const BarcodeRenderer: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // @ts-ignore
        if (window.JsBarcode) {
          // @ts-ignore
          window.JsBarcode(svgRef.current, value, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true
          });
        }
      } catch (err) {
        console.error("Barcode generation failed", err);
      }
    }
  }, [value]);

  return <svg ref={svgRef} className={className}></svg>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'history' | 'scan'>('dashboard');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    if (!db) {
      const localProducts = localStorage.getItem('demo_products');
      const localHistory = localStorage.getItem('demo_history');
      setProducts(localProducts ? JSON.parse(localProducts) : []);
      setTransactions(localHistory ? JSON.parse(localHistory) : []);
      setCategories(INITIAL_CATEGORIES);
      setTypes(INITIAL_TYPES);
      setLoading(false);
      return;
    }

    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    const unsubCats = onSnapshot(collection(db, "categories"), (snapshot) => {
      const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      setCategories(cats.length > 0 ? cats : INITIAL_CATEGORIES);
    });

    const unsubTypes = onSnapshot(collection(db, "types"), (snapshot) => {
      const typs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Type));
      setTypes(typs.length > 0 ? typs : INITIAL_TYPES);
    });

    const unsubHistory = onSnapshot(query(collection(db, "transactions"), orderBy("timestamp", "desc")), (snapshot) => {
      setTransactions(snapshot.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data, 
          timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString() 
        } as unknown as Transaction;
      }));
    });

    return () => {
      unsubProducts(); unsubCats(); unsubTypes(); unsubHistory();
    };
  }, [user]);

  useEffect(() => {
    if (!db && user) {
      localStorage.setItem('demo_products', JSON.stringify(products));
      localStorage.setItem('demo_history', JSON.stringify(transactions));
    }
  }, [products, transactions, user]);

  const isAdmin = user?.role === Role.ADMIN;

  const handleTransaction = async (productId: string, qty: number, type: TransactionType) => {
    if (!user) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (db) {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, {
        stock: increment(type === TransactionType.IN ? qty : -qty),
        updatedAt: serverTimestamp()
      });
      await addDoc(collection(db, "transactions"), {
        productId, productName: product.name, type, quantity: qty, userName: user.name, timestamp: serverTimestamp()
      });
    } else {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: Math.max(0, type === TransactionType.IN ? p.stock + qty : p.stock - qty) } : p));
      setTransactions(prev => [{ id: Date.now().toString(), productId, productName: product.name, type, quantity: qty, userName: user.name, timestamp: new Date().toISOString() }, ...prev]);
    }
  };

  const addProduct = async (data: Partial<Product>) => {
    const code = "BRG-" + Math.floor(1000 + Math.random() * 9000);
    const newProduct = {
      code, name: data.name, barcode: code, categoryId: data.categoryId, typeId: data.typeId, stock: Number(data.stock) || 0, updatedAt: new Date().toISOString()
    };
    if (db) {
      await addDoc(collection(db, "products"), { ...newProduct, updatedAt: serverTimestamp() });
    } else {
      setProducts(prev => [...prev, { id: Date.now().toString(), ...newProduct } as Product]);
    }
    setShowProductModal(false);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Hapus barang ini?')) return;
    if (db) await deleteDoc(doc(db, "products", id));
    else setProducts(prev => prev.filter(p => p.id !== id));
  };

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
          <div className="mb-6 flex justify-center text-blue-600">
            <Icons.Warehouse />
          </div>
          <h1 className="text-2xl font-black mb-2 text-slate-800">SmartWarehouse</h1>
          <p className="text-slate-500 mb-8 text-sm">Pilih akses masuk:</p>
          <div className="space-y-4">
            <button onClick={() => setUser({ name: 'Admin Gudang', role: Role.ADMIN })} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-200">Mode Admin</button>
            <button onClick={() => setUser({ name: 'Staff Scanner', role: Role.USER })} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all">Mode Staff</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="bg-white border-b sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-xl">
            <Icons.Warehouse />
          </div>
          <div>
            <h1 className="font-black text-xl text-slate-800">SmartWarehouse</h1>
            <div className="flex items-center gap-2">
               <span className={`w-2 h-2 rounded-full ${db ? 'bg-green-500' : 'bg-orange-500'}`}></span>
               <p className="text-[10px] font-bold text-slate-400 uppercase">{db ? 'Cloud Active' : 'Offline Mode'}</p>
            </div>
          </div>
        </div>
        <button onClick={() => { setUser(null); setLoading(true); }} className="text-xs font-black text-red-500 uppercase border-2 border-red-100 px-3 py-1.5 rounded-xl">Logout</button>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:flex gap-6">
        <nav className="hidden md:flex flex-col w-64 gap-2 h-[calc(100vh-120px)] sticky top-24 no-print">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Warehouse />} label="Dashboard" />
          <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Icons.Box />} label="Inventory" />
          <NavItem active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={<Icons.Scan />} label="Scanner" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Icons.History />} label="Riwayat" />
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === 'dashboard' && <DashboardView products={products} transactions={transactions} onNavigate={setActiveTab} />}
          {activeTab === 'inventory' && (
            <InventoryView 
              products={products} 
              categories={categories} 
              types={types}
              isAdmin={isAdmin}
              onAdd={() => { setEditingProduct(null); setShowProductModal(true); }}
              onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }}
              onDelete={deleteProduct}
              onTransact={handleTransaction}
            />
          )}
          {activeTab === 'history' && <HistoryView transactions={transactions} />}
          {activeTab === 'scan' && <ScanView products={products} onScan={handleTransaction} />}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-40 shadow-lg no-print">
        <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Warehouse />} label="Home" />
        <MobileNavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Icons.Box />} label="Stok" />
        <button onClick={() => setActiveTab('scan')} className="relative -mt-10">
           <div className={`p-4 rounded-full shadow-2xl transition-all ${activeTab === 'scan' ? 'bg-blue-600' : 'bg-slate-800'}`}>
              <div className="text-white"><Icons.Scan /></div>
           </div>
        </button>
        <MobileNavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Icons.History />} label="Logs" />
      </nav>

      {showProductModal && (
        <ProductFormModal 
          product={editingProduct} 
          categories={categories} 
          types={types}
          onSave={editingProduct ? (d) => updateDoc(doc(db, "products", editingProduct.id), d) : addProduct}
          onClose={() => setShowProductModal(false)}
          onAddCategory={(name) => db ? addDoc(collection(db, "categories"), { name }) : setCategories(p => [...p, {id: Date.now().toString(), name}])}
          onAddType={(name) => db ? addDoc(collection(db, "types"), { name }) : setTypes(p => [...p, {id: Date.now().toString(), name}])}
        />
      )}
    </div>
  );
};

// UI Components
const NavItem = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white text-slate-400'}`}>
    {icon} {label}
  </button>
);

const MobileNavItem = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-blue-600' : 'text-slate-300'}`}>
    {icon}
    <span className="text-[10px] font-black uppercase">{label}</span>
  </button>
);

const DashboardView = ({ products, transactions, onNavigate }: any) => {
  const stats = {
    total: products.length,
    stock: products.reduce((a: any, b: any) => a + b.stock, 0),
    low: products.filter((p: any) => p.stock < 5).length,
    today: transactions.filter((t: any) => new Date(t.timestamp).toDateString() === new Date().toDateString()).length
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produk" value={stats.total} />
        <StatCard label="Total Stok" value={stats.stock} />
        <StatCard label="Tx Hari Ini" value={stats.today} />
        <StatCard label="Stok Rendah" value={stats.low} isAlert={stats.low > 0} />
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-black text-slate-800 mb-4 uppercase text-xs tracking-widest">Aktivitas Terkini</h3>
        <div className="space-y-3">
          {transactions.slice(0, 5).map((t: any) => (
            <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
              <div>
                <p className="font-bold text-sm">{t.productName}</p>
                <p className="text-[10px] text-slate-400 font-bold">{t.userName}</p>
              </div>
              <span className={`font-black ${t.type === 'MASUK' ? 'text-green-500' : 'text-red-500'}`}>{t.type === 'MASUK' ? '+' : '-'}{t.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, isAlert }: any) => (
  <div className={`bg-white p-5 rounded-3xl shadow-sm border-b-4 ${isAlert ? 'border-red-500 animate-pulse' : 'border-blue-100'}`}>
    <p className="text-slate-400 text-[10px] font-black uppercase mb-1">{label}</p>
    <p className="text-2xl font-black text-slate-800">{value}</p>
  </div>
);

const InventoryView = ({ products, categories, types, isAdmin, onAdd, onEdit, onDelete, onTransact }: any) => {
  const [q, setQ] = useState('');
  const filtered = products.filter((p: any) => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()));
  
  const handlePrintBarcode = (p: Product) => {
    const win = window.open('', '_blank');
    if(win) {
      win.document.write(`
        <html>
          <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
            <h2 style="margin-bottom:10px;">${p.name}</h2>
            <div id="barcode"></div>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <script>
              const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
              document.getElementById('barcode').appendChild(svg);
              JsBarcode(svg, "${p.barcode}", { format: "CODE128", displayValue: true });
              window.onload = () => { window.print(); window.close(); };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input type="text" placeholder="Cari barang atau kode..." className="flex-1 bg-white border-none rounded-2xl p-4 shadow-sm font-bold text-sm" onChange={e => setQ(e.target.value)} />
        {isAdmin && <button onClick={onAdd} className="bg-blue-600 text-white px-6 rounded-2xl font-black uppercase text-xs">Tambah</button>}
      </div>
      <div className="grid gap-3">
        {filtered.map((p: any) => (
          <div key={p.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-50 flex justify-between items-center group">
            <div className="flex gap-4 items-center">
              <div className="hidden sm:block opacity-20 group-hover:opacity-100 cursor-pointer" onClick={() => handlePrintBarcode(p)}>
                <BarcodeRenderer value={p.barcode} className="h-10 w-24" />
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase">{p.code}</p>
                <h4 className="font-bold text-slate-800">{p.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Stok: {p.stock} • {categories.find((c: any) => c.id === p.categoryId)?.name}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onTransact(p.id, 1, TransactionType.IN)} className="w-10 h-10 rounded-xl bg-green-50 text-green-600 font-bold">+</button>
              <button onClick={() => onTransact(p.id, 1, TransactionType.OUT)} className="w-10 h-10 rounded-xl bg-red-50 text-red-600 font-bold">-</button>
              {isAdmin && (
                <button onClick={() => onDelete(p.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-red-500"><Icons.Trash /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const HistoryView = ({ transactions }: any) => (
  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
    <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
       <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Riwayat Transaksi</h3>
       <button onClick={() => window.print()} className="text-[10px] font-black uppercase text-blue-600">Download PDF</button>
    </div>
    <div className="divide-y divide-slate-50">
      {transactions.map((t: any) => (
        <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
          <div>
            <p className="font-bold text-sm text-slate-800">{t.productName}</p>
            <p className="text-[10px] text-slate-400 font-bold">{new Date(t.timestamp).toLocaleString()} • {t.userName}</p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${t.type === 'MASUK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {t.type} {t.quantity}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const ScanView = ({ products, onScan }: any) => {
  const [mode, setMode] = useState<TransactionType>(TransactionType.IN);
  const [isCam, setIsCam] = useState(false);
  const [manual, setManual] = useState('');

  const handleManual = (e: any) => {
    if (e.key === 'Enter') {
      const p = products.find((x: any) => x.barcode === manual || x.code === manual);
      if (p) { onScan(p.id, 1, mode); setManual(''); }
      else alert("Barang tidak ditemukan!");
    }
  };

  const startCam = () => {
    setIsCam(true);
    setTimeout(() => {
      // @ts-ignore
      const scanner = new window.Html5Qrcode("reader");
      scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text: string) => {
           const p = products.find((x: any) => x.barcode === text || x.code === text);
           if (p) { onScan(p.id, 1, mode); if (navigator.vibrate) navigator.vibrate(50); }
      }, () => {});
    }, 200);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-white p-8 rounded-[40px] shadow-2xl text-center border border-slate-100">
         <div className="flex gap-2 justify-center mb-6">
           <button onClick={() => setMode(TransactionType.IN)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition ${mode === TransactionType.IN ? 'bg-green-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Masuk</button>
           <button onClick={() => setMode(TransactionType.OUT)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition ${mode === TransactionType.OUT ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Keluar</button>
         </div>
         {isCam ? <div className="rounded-3xl overflow-hidden bg-black aspect-square mb-6"><div id="reader"></div></div> : 
           <button onClick={startCam} className="w-full aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center mb-6 hover:bg-slate-100">
              <Icons.Scan /> <p className="text-[10px] font-black uppercase text-slate-400 mt-4">Ketuk untuk Scan Kamera</p>
           </button>
         }
         <input type="text" placeholder="Atau ketik barcode manual..." className="w-full bg-slate-100 border-none rounded-2xl p-4 text-center font-black" value={manual} onChange={e => setManual(e.target.value)} onKeyDown={handleManual} />
      </div>
    </div>
  );
};

const ProductFormModal = ({ product, categories, types, onSave, onClose, onAddCategory, onAddType }: any) => {
  const [form, setForm] = useState(product || { name: '', categoryId: categories[0]?.id || '', typeId: types[0]?.id || '', stock: 0 });
  const [nc, setNc] = useState('');
  const [nt, setNt] = useState('');
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg p-8 space-y-6 animate-in zoom-in duration-300">
        <h2 className="text-2xl font-black text-slate-800">{product ? 'Edit Barang' : 'Barang Baru'}</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Nama Barang" className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <select className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-sm" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <div className="mt-2 flex gap-1"><input type="text" className="w-full text-[10px] p-2 border rounded-lg" placeholder="Kategori Baru" value={nc} onChange={e => setNc(e.target.value)} /><button onClick={() => {onAddCategory(nc); setNc('');}} className="text-[10px] bg-blue-100 px-2 rounded-lg font-bold">Add</button></div>
            </div>
            <div>
              <select className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-sm" value={form.typeId} onChange={e => setForm({...form, typeId: e.target.value})}>{types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <div className="mt-2 flex gap-1"><input type="text" className="w-full text-[10px] p-2 border rounded-lg" placeholder="Jenis Baru" value={nt} onChange={e => setNt(e.target.value)} /><button onClick={() => {onAddType(nt); setNt('');}} className="text-[10px] bg-blue-100 px-2 rounded-lg font-bold">Add</button></div>
            </div>
          </div>
          {!product && <input type="number" placeholder="Stok Awal" className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value)})} />}
        </div>
        <div className="flex gap-3"><button onClick={onClose} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black uppercase text-slate-500 text-xs">Batal</button><button onClick={() => onSave(form)} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black uppercase text-white text-xs shadow-lg shadow-blue-200">Simpan Barang</button></div>
      </div>
    </div>
  );
};

export default App;