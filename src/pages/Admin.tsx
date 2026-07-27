import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../api/api';
import { User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiService.fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    setLoading(true);
    try {
      const res = await apiService.register(form);
      if (res.success || res.id) {
        setForm({ username: '', password: '' });
        fetchUsers();
        alert('Usuario registrado con éxito');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar usuario? Esta acción no se puede deshacer.')) return;
    try {
      await apiService.deleteUser(id);
      fetchUsers();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({ username: user.username, password: '' });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      await apiService.updateUser(editingUser.id, editForm.username, editForm.password || null);
      setEditingUser(null);
      fetchUsers();
      alert('Usuario actualizado');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateThumbnails = async () => {
    setIsRegenerating(true);
    try {
      const res = await apiService.regenerateAllMedia();
      alert(res.message);
    } catch (err) {
      alert('Error al solicitar la regeneración de miniaturas.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050712] p-6 pb-20">
      <header className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="font-title text-4xl text-white">Administración</h1>
        </div>

        {/* Botón de Regeneración de Miniaturas */}
        <button 
          onClick={handleRegenerateThumbnails}
          disabled={isRegenerating}
          className="flex items-center gap-2 px-4 py-2 bg-[#7C1039]/10 border border-[#7C1039]/30 rounded-xl text-[#7C1039] hover:bg-[#7C1039] hover:text-white transition-all disabled:opacity-50 text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#7C1039]/5"
        >
          {isRegenerating ? (
            <div className="w-4 h-4 border-2 border-[#7C1039]/30 border-t-[#7C1039] rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          )}
          {isRegenerating ? 'Procesando...' : 'Regenerar Miniaturas'}
        </button>
      </header>

      <main className="max-w-2xl mx-auto space-y-10">
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1a0a14] to-[#050712] p-8 rounded-[28px] border border-white/5 shadow-xl"
        >
          <h2 className="text-xl font-bold mb-6 text-white tracking-tight">Registrar Nuevo Usuario</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </span>
              <input 
                type="text" 
                placeholder="Nombre de Usuario"
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
                className="w-full bg-white/5 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#7C1039]/50 transition-all"
                required
              />
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </span>
              <input 
                type="password" 
                placeholder="Contraseña"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="w-full bg-white/5 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#7C1039]/50 transition-all"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#7C1039] text-white font-bold py-4 rounded-xl hover:bg-[#9E1449] disabled:opacity-50 transition-all uppercase tracking-widest text-xs shadow-lg shadow-[#7C1039]/20"
            >
              {loading ? 'REGISTRANDO...' : 'REGISTRAR AHORA'}
            </button>
          </form>
        </motion.section>

        <section>
          <h3 className="text-white/30 text-[10px] font-black tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
            <span>USUARIOS REGISTRADOS</span>
            <div className="h-[1px] flex-1 bg-white/5" />
            <span className="bg-white/5 px-2.5 py-1 rounded-lg text-white/50">{users.length}</span>
          </h3>
          <div className="space-y-3">
            {users.map(u => (
              <motion.div 
                layout
                key={u.id} 
                className="bg-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors group border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#7C1039]/20 border border-[#7C1039]/30 rounded-full flex items-center justify-center text-[#7C1039] font-black text-xl">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg leading-none mb-1">{u.username}</p>
                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Colaborador</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => openEditModal(u)}
                    className="p-3 text-white/20 hover:text-blue-400 hover:bg-blue-400/5 rounded-2xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button 
                    onClick={() => handleDelete(u.id)} 
                    className="p-3 text-white/20 hover:text-red-500 hover:bg-red-500/5 rounded-2xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </motion.div>
            ))}
            {users.length === 0 && (
              <p className="text-center text-white/10 py-10 font-bold uppercase tracking-widest text-xs">No hay otros usuarios creados</p>
            )}
          </div>
        </section>
      </main>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0c1a] border border-white/10 rounded-[40px] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Editar Usuario</h2>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-2">Nombre de usuario</label>
                  <input 
                    type="text" 
                    value={editForm.username}
                    onChange={e => setEditForm({...editForm, username: e.target.value})}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-[#7C1039]/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-2">Nueva contraseña (opcional)</label>
                  <input 
                    type="password" 
                    placeholder="Dejar vacío para no cambiar"
                    value={editForm.password}
                    onChange={e => setEditForm({...editForm, password: e.target.value})}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-[#7C1039]/50"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-4 text-white/40 font-bold hover:text-white transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#7C1039] text-white font-bold py-4 rounded-[20px] hover:bg-[#9E1449] transition-all disabled:opacity-50"
                  >
                    {loading ? 'GUARDANDO...' : 'GUARDAR'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;