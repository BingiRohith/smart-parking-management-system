import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAdmin, isSecurity } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand">
          <span className="navbar__brand-icon">🅿</span>
          <span className="navbar__brand-name">SmartPark</span>
        </Link>

        <div className="navbar__actions">
          {user ? (
            <>
              <span className="navbar__user">
                <span className="navbar__role-badge">{user.role}</span>
                {user.name}
              </span>
              {isAdmin && (
                <Link to="/admin" className="btn btn--secondary btn--sm">
                  Dashboard
                </Link>
              )}
              {isSecurity && (
                <Link to="/security" className="btn btn--secondary btn--sm">
                  My Floor
                </Link>
              )}
              <button onClick={handleLogout} className="btn btn--danger btn--sm">
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn--secondary btn--sm">
              Staff Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
