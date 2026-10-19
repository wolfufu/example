import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Сайдбар */}
            <aside style={{ width: '250px', background: '#1e293b', color: 'white', padding: '20px' }}>
                <h2>Admin Panel</h2>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '30px' }}>
                    {/* Здесь легко добавлять новые модули */}
                    <NavLink to="/admin/users" style={({ isActive }) => ({ color: isActive ? '#60a5fa' : 'white', textDecoration: 'none' })}>
                        Пользователи
                    </NavLink>
                    <NavLink to="/admin/settings" style={({ isActive }) => ({ color: isActive ? '#60a5fa' : 'white', textDecoration: 'none' })}>
                        Настройки (заглушка)
                    </NavLink>
                </nav>
                <button onClick={handleLogout} style={{ marginTop: '50px', cursor: 'pointer' }}>Выйти</button>
            </aside>

            {/* Основной контент */}
            <main style={{ flex: 1, padding: '40px', background: '#f1f5f9' }}>
                <Outlet />
            </main>
        </div>
    );
}