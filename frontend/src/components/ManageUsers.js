import React, { useEffect, useState } from 'react';
import './ManageUsers.scss';
import SuccessMessage from './SuccessMessage';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [successMessages, setSuccessMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, id: null });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/users");
        const data = await response.json();
        console.log("Fetched users:", data);
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
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingUser(prevUser => ({
      ...prevUser,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);

    try {
      const response = await fetch(`http://localhost:3000/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingUser),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error updating user:', errorData.message);
        return;
      }

      console.log('User updated successfully');
      setSuccessMessages(prevMessages => [...prevMessages, 'User updated successfully!']);

      // Fetch the updated list of users
      const updatedUsersResponse = await fetch("http://localhost:3000/api/users");
      const updatedUsersData = await updatedUsersResponse.json();
      setUsers(updatedUsersData);
      setFilteredUsers(updatedUsersData);

      setEditingUser(null);

      setTimeout(() => {
        setSuccessMessages(prevMessages => prevMessages.slice(1));
      }, 3000);
    } catch (error) {
      console.error('Network error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (u_id) => {
    setDeleteConfirmation({ show: true, id: u_id });
  };

  const confirmDelete = async () => {
    const u_id = deleteConfirmation.id;
    setDeleteConfirmation({ show: false, id: null });

    if (isNaN(u_id) || u_id <= 0) {
      console.error('Invalid U_ID');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/users/${u_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error deleting user:', errorData.message);
        return;
      }

      console.log('User deleted successfully');
      setSuccessMessages(prevMessages => [...prevMessages, 'User deleted successfully!']);

      // Fetch the updated list of users
      const updatedUsersResponse = await fetch("http://localhost:3000/api/users");
      const updatedUsersData = await updatedUsersResponse.json();
      setUsers(updatedUsersData);
      setFilteredUsers(updatedUsersData);

      setTimeout(() => {
        setSuccessMessages(prevMessages => prevMessages.slice(1));
      }, 3000);
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({ show: false, id: null });
  };


  const handleCloseMessage = (index) => {
    setSuccessMessages(prevMessages => prevMessages.filter((_, i) => i !== index));
  };

  const handleCancelClick = () => {
    setEditingUser(null);
  };

  // Helper function to map role values to display names
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'normal_user':
        return 'Normal User';
      case 'admin':
        return 'Administrator';
      default:
        return 'Unknown Role';
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="edit-users-container">
      <h2>Edit Users</h2>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={handleSearch}
        />
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone Number</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.phonenum}</td>
              <td>{getRoleDisplayName(user.role)}</td>
              <td>
                <button className="edit-button" onClick={() => handleEditClick(user)}>
                  <i className="fas fa-pencil-alt"></i> Edit
                </button>
                <button className="delete-button" onClick={() => handleDeleteClick(user.id)}>
                  <i className="fas fa-trash-alt"></i> Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingUser && (
        <div className="edit-form">
          <h3>Edit User</h3>
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={editingUser.name}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Email:
            <input
              type="email"
              name="email"
              value={editingUser.email}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Phone Number:
            <input
              type="text"
              name="phonenum"
              value={editingUser.phonenum}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Role:
            <select
              name="role"
              value={editingUser.role}
              onChange={handleInputChange}
            >
              <option value="normal_user">Normal User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Password:
            <input
              type="password"
              name="password"
              onChange={handleInputChange}
            />
          </label>
          <button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={handleCancelClick} className="cancel-button">
            <i className="fas fa-times"></i> Cancel
          </button>
        </div>
      )}

      <SuccessMessage messages={successMessages} onClose={handleCloseMessage} />

      {deleteConfirmation.show && (
        <div className="confirmation-dialog">
          <p>Are you sure you want to delete this user?</p>
          <button onClick={confirmDelete}>Yes, Delete</button>
          <button onClick={cancelDelete}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
