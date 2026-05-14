import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Menu, Ward } from '../types';
import { Trash2, Plus, Database, Landmark } from 'lucide-react';
import { motion } from 'motion/react';

export default function MasterData() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [activeTab, setActiveTab] = useState<'menus' | 'wards'>('menus');
  
  // Menu form
  const [menuName, setMenuName] = useState('');
  const [weight, setWeight] = useState('');
  const [dietType, setDietType] = useState('');
  const [cycleDay, setCycleDay] = useState('');

  // Ward form
  const [wardName, setWardName] = useState('');

  const fetchData = async () => {
    const menuSnap = await getDocs(collection(db, 'menus'));
    setMenus(menuSnap.docs.map(d => ({ id: d.id, ...d.data() } as Menu)));

    const wardSnap = await getDocs(collection(db, 'wards'));
    setWards(wardSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ward)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName || !weight || !dietType) return;
    await addDoc(collection(db, 'menus'), {
      name: menuName,
      standardWeight: Number(weight),
      dietType,
      cycleDay: Number(cycleDay) || 1,
      createdAt: serverTimestamp()
    });
    setMenuName('');
    setWeight('');
    setDietType('');
    setCycleDay('');
    fetchData();
  };

  const handleAddWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardName) return;
    await addDoc(collection(db, 'wards'), {
      name: wardName,
      createdAt: serverTimestamp()
    });
    setWardName('');
    fetchData();
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!confirm('Are you sure?')) return;
    await deleteDoc(doc(db, coll, id));
    fetchData();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Master Data</h2>
          <p className="text-slate-500">Manage hospital food items and wards database</p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('menus')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'menus' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Menus
          </button>
          <button
            onClick={() => setActiveTab('wards')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'wards' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Wards
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <motion.div
           layout
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 h-fit"
        >
          {activeTab === 'menus' ? (
            <form onSubmit={handleAddMenu} className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Database size={20} />
                <h3 className="font-bold">Add New Menu</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Menu Name</label>
                <input
                  type="text"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                  placeholder="e.g. Nasi Ayam Bakar"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Std Weight (g)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                    placeholder="300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cycle Day</label>
                  <input
                    type="number"
                    value={cycleDay}
                    onChange={(e) => setCycleDay(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                    placeholder="1-10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Diet Type</label>
                <input
                  type="text"
                  value={dietType}
                  onChange={(e) => setDietType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                  placeholder="e.g. Diet Rendah Garam"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Menu
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddWard} className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Landmark size={20} />
                <h3 className="font-bold">Add New Ward</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ward Name</label>
                <input
                  type="text"
                  value={wardName}
                  onChange={(e) => setWardName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
                  placeholder="e.g. Bangsal Melati"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Ward
              </button>
            </form>
          )}
        </motion.div>

        {/* List Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 min-h-[400px]">
          <h3 className="font-bold text-slate-800 mb-6">Existing {activeTab === 'menus' ? 'Menus' : 'Wards'}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="pb-4 px-2">{activeTab === 'menus' ? 'Menu Name' : 'Ward Name'}</th>
                  {activeTab === 'menus' && (
                    <>
                      <th className="pb-4">Weight</th>
                      <th className="pb-4">Diet</th>
                    </>
                  )}
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeTab === 'menus' ? (
                  menus.map(menu => (
                    <tr key={menu.id} className="text-sm">
                      <td className="py-4 px-2 font-medium text-slate-700">{menu.name}</td>
                      <td className="py-4 text-slate-500">{menu.standardWeight}g</td>
                      <td className="py-4 text-slate-500">{menu.dietType}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => handleDelete('menus', menu.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  wards.map(ward => (
                    <tr key={ward.id} className="text-sm">
                      <td className="py-4 px-2 font-medium text-slate-700">{ward.name}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => handleDelete('wards', ward.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {(activeTab === 'menus' ? menus.length : wards.length) === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 italic">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
