import React, { useEffect, useState, useMemo } from 'react';
import './ManageUsers.scss';
import SuccessMessage from '../SuccessMessage';
import EditUserModal from './EditUserModal';
import DeleteUserModal from './DeleteUserModal';
import CreateUserModal from './CreateUserModal';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaSpinner, FaUser } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
const ClientOnlyTooltip = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Tooltip
      id="main-tooltip"
      style={{
        zIndex: 9999,
        backgroundColor: '#2d3748',
        color: '#fff',
        borderRadius: '6px',
        fontSize: '14px'
      }}
    />
  );
};
const ManageUsers = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [deletingUser, setDeletingUser] = useState(null);
    const [successMessages, setSuccessMessages] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch("http://localhost:3000/api/users");
                const data = await response.json();
                setUsers(data);
                setFilteredUsers(data);
            } catch (error) {
                console.error("Error fetching users:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        const filtered = users.filter(user =>
            user.name.toLowerCase().includes(term.toLowerCase()) ||
            user.email.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredUsers(filtered);
        setCurrentPage(1);
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
    };

    const handleSave = async (updatedUser) => {
        setIsSaving(true);

        try {
            const response = await fetch(`http://localhost:3000/api/users/${updatedUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedUser),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error updating user:', errorData.message);
                return;
            }

            setSuccessMessages(['User updated successfully!']);

            const updatedUsersResponse = await fetch("http://localhost:3000/api/users");
            const updatedUsersData = await updatedUsersResponse.json();
            setUsers(updatedUsersData);
            setFilteredUsers(updatedUsersData);

            setEditingUser(null);
            setIsSaving(false);

            setTimeout(() => {
                setSuccessMessages([]);
            }, 3000);
        } catch (error) {
            console.error('Network error:', error);
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (user) => {
        setDeletingUser(user);
    };

    const confirmDelete = async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/users/${deletingUser.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error deleting user:', errorData.message);
                return;
            }

            setSuccessMessages(['User deleted successfully!']);

            const updatedUsersResponse = await fetch("http://localhost:3000/api/users");
            const updatedUsersData = await updatedUsersResponse.json();
            setUsers(updatedUsersData);
            setFilteredUsers(updatedUsersData);

        } catch (error) {
            console.error('Network error:', error);
        } finally {
            setDeletingUser(null);
            setTimeout(() => {
                setSuccessMessages([]);
            }, 3000);
        }
    };

    const cancelDelete = () => {
        setDeletingUser(null);
    };

    const handleCloseMessage = (index) => {
        setSuccessMessages(prevMessages => prevMessages.filter((_, i) => i !== index));
    };

    const handleCancelEdit = () => {
        setEditingUser(null);
    };

    const handleCreateClick = () => {
        setIsCreating(true);
    };

    const handleCloseCreate = () => {
        setIsCreating(false);
    };

    const handleUserCreated = (newUser) => {
        setUsers(prevUsers => [...prevUsers, newUser]);
        setFilteredUsers(prevFilteredUsers => [...prevFilteredUsers, newUser]);
    };

    const getRoleDisplayName = (user) => {
        return user.isAdmin ? 'Admin' : 'Normal User';
    };

    const sortedUsers = useMemo(() => {
        let sortableUsers = [...filteredUsers];
        if (sortConfig.key !== null) {
            sortableUsers.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableUsers;
    }, [filteredUsers, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Pagination
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    if (loading) {
        return (
            <div className="loading-spinner">
                <FaSpinner className="spinner-icon" />
                <span>Loading users...</span>
            </div>
        );
    }

    return (
      <div className="manage-users-container">
        <ClientOnlyTooltip />
        <h2>Manage Users</h2>

        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={handleSearch}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm("")}>
              &times;
            </button>
          )}
        </div>

        {currentUsers.length === 0 ? (
          <div className="empty-state">
            <FaUser className="empty-icon" />
            <p>No users found.</p>
          </div>
        ) : (
          <div className="user-table-container">
            <table className="user-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort("name")}>
                    Name{" "}
                    {sortConfig.key === "name" &&
                      (sortConfig.direction === "ascending" ? "▲" : "▼")}
                  </th>
                  <th onClick={() => requestSort("email")}>
                    Email{" "}
                    {sortConfig.key === "email" &&
                      (sortConfig.direction === "ascending" ? "▲" : "▼")}
                  </th>
                  <th onClick={() => requestSort("phonenum")}>
                    Phone{" "}
                    {sortConfig.key === "phonenum" &&
                      (sortConfig.direction === "ascending" ? "▲" : "▼")}
                  </th>
                  <th onClick={() => requestSort("isAdmin")}>
                    Role{" "}
                    {sortConfig.key === "isAdmin" &&
                      (sortConfig.direction === "ascending" ? "▲" : "▼")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.phonenum}</td>
                    <td>
                      <span
                        className={`status-indicator ${
                          user.isAdmin ? "admin" : "user"
                        }`}
                      >
                        {getRoleDisplayName(user)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="edit-button"
                        onClick={() => handleEditClick(user)}
                        data-tooltip-id="main-tooltip"
                        data-tooltip-content="Edit user"
                      >
                        <FaEdit /> Edit
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteClick(user)}
                        data-tooltip-id="main-tooltip"
                        data-tooltip-content="Delete user"
                      >
                        <FaTrash /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          usersPerPage={usersPerPage}
          totalUsers={sortedUsers.length}
          paginate={paginate}
          currentPage={currentPage}
        />

        <button
          className="create-button"
          onClick={handleCreateClick}
          data-tooltip-id="main-tooltip"
          data-tooltip-content="Create new user"
        >
          <FaPlus />
        </button>

        {editingUser && (
          <EditUserModal
            user={editingUser}
            onClose={handleCancelEdit}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}

        {deletingUser && (
          <DeleteUserModal
            user={deletingUser}
            onClose={cancelDelete}
            onConfirm={confirmDelete}
          />
        )}

        {isCreating && (
          <CreateUserModal
            onClose={handleCloseCreate}
            onCreate={handleUserCreated}
          />
        )}

        <SuccessMessage
          messages={successMessages}
          onClose={handleCloseMessage}
        />
      </div>
    );
};

const Pagination = ({ usersPerPage, totalUsers, paginate, currentPage }) => {
    const pageNumbers = [];

    for (let i = 1; i <= Math.ceil(totalUsers / usersPerPage); i++) {
        pageNumbers.push(i);
    }

    return (
        <nav>
            <ul className="pagination">
                {pageNumbers.map(number => (
                    <li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}>
                        <button onClick={() => paginate(number)} className="page-link">
                            {number}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default ManageUsers;
