import React, { useEffect, useState, useMemo } from 'react';
import './ManageUsers.scss';
import SuccessMessage from '../SuccessMessage';
import EditUserModal from './EditUserModal';
import DeleteUserModal from './DeleteUserModal';
import CreateUserModal from './CreateUserModal';
import { FaPlus, FaEdit, FaTrash, FaUser } from 'react-icons/fa';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DataTable from '../common/DataTable';



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
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await axios.get('http://localhost:3000/api/users', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setUsers(response.data);
            setFilteredUsers(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (searchTerm) {
            const filtered = users.filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(users);
        }
    }, [searchTerm, users]);

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
    };

    const handleSave = async (updatedUser) => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await axios.put(
                `http://localhost:3000/api/users/${updatedUser.id}`,
                updatedUser,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            setSuccessMessages(['User updated successfully!']);
            await fetchUsers();
            setEditingUser(null);
        } catch (err) {
            console.error('Error updating user:', err);
            setError(err.response?.data?.message || 'Error updating user');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (user) => {
        setDeletingUser(user);
    };

    const confirmDelete = async () => {
        try {
            const token = localStorage.getItem('authToken');
            await axios.delete(`http://localhost:3000/api/users/${deletingUser.id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setSuccessMessages(['User deleted successfully!']);
            await fetchUsers();
        } catch (err) {
            console.error('Error deleting user:', err);
            setError(err.response?.data?.message || 'Error deleting user');
        } finally {
            setDeletingUser(null);
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

    const handleUserCreated = async (newUser) => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await axios.post('http://localhost:3000/api/users/create', newUser, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setSuccessMessages(['User created successfully!']);
            await fetchUsers();
            setIsCreating(false);
        } catch (err) {
            console.error('Error creating user:', err);
            setError(err.response?.data?.message || 'Error creating user');
        }
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

    const paginate = (pageNumber) => setCurrentPage(pageNumber);



    const columns = [
      {
        key: 'name',
        label: 'Name',
        sortable: true
      },
      {
        key: 'email',
        label: 'Email',
        sortable: true
      },
      {
        key: 'phonenum',
        label: 'Phone',
        sortable: true
      },
      {
        key: 'isAdmin',
        label: 'Role',
        sortable: true,
        render: (user) => (
          <span className={`status-indicator ${user.isAdmin ? "admin" : "user"}`}>
            {getRoleDisplayName(user)}
          </span>
        )
      },
      {
        key: 'actions',
        label: 'Actions',
        sortable: false,
        render: (user) => (
          <>
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
          </>
        )
      }
    ];

    const actionButtons = [
      {
        icon: <FaPlus />,
        text: '',
        className: 'create-button',
        tooltip: 'Create new user',
        onClick: handleCreateClick
      }
    ];

    return (
      <div className="manage-users-container">
        <DataTable
          title="Manage Users"
          data={sortedUsers}
          columns={columns}
          loading={loading}
          error={error}
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          onClearSearch={() => setSearchTerm("")}
          searchPlaceholder="Search by name or email..."
          emptyStateMessage="No users found."
          emptyStateIcon={FaUser}
          itemsPerPage={usersPerPage}
          currentPage={currentPage}
          onPageChange={paginate}
          sortConfig={sortConfig}
          onSort={requestSort}
          actionButtons={actionButtons}
          containerClassName="manage-users-container"
        />

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

export default ManageUsers;
