import React, { useEffect, useState } from 'react';
import './EditUsers.css'; // Import the CSS file for styling
import SuccessMessage from './SuccessMessage'; // Import the SuccessMessage component

const EditUsers = () => {
  const [users, setUsers] = useState([]); // State to hold users
  const [loading, setLoading] = useState(true); // State to manage loading status
  const [editingUser, setEditingUser] = useState(null); // State to manage the user being edited
  const [successMessages, setSuccessMessages] = useState([]); // State for success messages

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/users");
        const data = await response.json();
        console.log("Fetched users:", data); // Log the fetched users
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers(); // Call the fetch function
  }, []);

  const handleEditClick = (user) => {
    setEditingUser(user); // Set the user to be edited
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingUser((prevUser) => ({
      ...prevUser,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(`http://localhost:3000/api/users/${editingUser.id}`, {
        method: 'PUT', // Use PUT or PATCH for updating
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingUser), // Send the updated user data
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error updating user:', errorData.message);
        return;
      }

      console.log('User updated successfully');
      setSuccessMessages((prevMessages) => [
        ...prevMessages,
        'User updated successfully!', // Add success message
      ]);

      // Fetch the updated list of users
      const updatedUsersResponse = await fetch("http://localhost:3000/api/users");
      const updatedUsersData = await updatedUsersResponse.json();
      setUsers(updatedUsersData); // Update the users state with the new list

      // Reset editing user after saving
      setEditingUser(null);

      // Set a timeout to remove the message after 3 seconds
      setTimeout(() => {
        setSuccessMessages((prevMessages) => prevMessages.slice(1)); // Remove the first message
      }, 3000);
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  const handleDeleteClick = async (u_id) => {
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
      setSuccessMessages((prevMessages) => [
        ...prevMessages,
        'User deleted successfully!', // Add success message
      ]);

      // Fetch the updated list of users
      const updatedUsersResponse = await fetch("http://localhost:3000/api/users");
      const updatedUsersData = await updatedUsersResponse.json();
      setUsers(updatedUsersData); // Update the users state with the new list

      // Set a timeout to remove the message after 3 seconds
      setTimeout(() => {
        setSuccessMessages((prevMessages) => prevMessages.slice(1)); // Remove the first message
      }, 3000);
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  const handleCloseMessage = (index) => {
    setSuccessMessages((prevMessages) => prevMessages.filter((_, i) => i !== index)); // Remove specific message
  };

  if (loading) {
    return <div>Loading...</div>; // Show loading message
  }

  return (
    <div className="edit-users-container">
      <h2>Edit Users</h2>
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone Number</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}> {/* Use user.id as the key */}
              <td>{user.name}</td> {/* Use user.name */}
              <td>{user.email}</td> {/* Use user.email */}
              <td>{user.phonenum}</td> {/* Use user.phonenum */}
              <td>
                <button className="edit-button" onClick={() => handleEditClick(user)}>
                  <i className="fas fa-pencil-alt"></i> Edit
                </button>
                <button className="delete-button" onClick={() => handleDeleteClick(user.id)}> {/* Use user.id */}
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
            Password:
            <input
              type="password"
              name="password"
              onChange={handleInputChange}
            />
          </label>
          <button onClick={handleSave}>Save</button>
        </div>
      )}

      <SuccessMessage messages={successMessages} onClose={handleCloseMessage} />
    </div>
  );
};

export default EditUsers;