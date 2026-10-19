import { useEffect, useState } from 'react';
import api from '../../api/client';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/admin/users/');
            setUsers(data);
        } catch (err) {
            setError('Ошибка загрузки. Возможно, у вас нет прав.');
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/users/', formData);
            setFormData({ name: '', email: '', password: '' });
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Ошибка создания');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Удалить пользователя?')) return;
        try {
            await api.delete(`/admin/users/${id}`);
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Ошибка удаления');
        }
    };

    return (
        <div>
            <h1>Управление пользователями</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {/* Форма создания */}
            <form onSubmit={handleCreate} style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
                <input required placeholder="Имя" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                <input required type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <input required type="password" placeholder="Пароль" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                <button type="submit">Создать</button>
            </form>

            {/* Таблица */}
            <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Роль</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => (
                        <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>{u.is_superuser ? 'Админ' : 'Юзер'}</td>
                            <td>
                                <button onClick={() => handleDelete(u.id)} style={{ color: 'red' }}>Удалить</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}