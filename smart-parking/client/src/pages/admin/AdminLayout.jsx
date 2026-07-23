import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AdminLayout.css';

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: '◎', end: true },
  { to: '/admin/floors', label: 'Floors', icon: '⊟' },
  { to: '/admin/staff', label: 'Staff', icon: '◉' },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__brand-icon">🅿</span>
          <div>
            <div className="admin-sidebar__brand-name">SmartPark</div>
            <div className="admin-sidebar__brand-sub">Admin Console</div>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `admin-sidebar__nav-item ${isActive ? 'admin-sidebar__nav-item--active' : ''}`
              }
            >
              <span className="admin-sidebar__nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__user-name">{user?.name}</div>
            <div className="admin-sidebar__user-role">Administrator</div>
          </div>
          <button onClick={handleLogout} className="admin-sidebar__logout">
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
