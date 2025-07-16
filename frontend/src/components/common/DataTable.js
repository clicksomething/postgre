import React from 'react';
import { FaSearch, FaUser } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import LoadingSpinner from './LoadingSpinner';
import './DataTable.scss';

const ClientOnlyTooltip = () => {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
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
                fontSize: '14px',
            }}
        />
    );
};

const DataTable = ({
    title,
    data,
    columns,
    loading,
    error,
    searchTerm,
    onSearchChange,
    onClearSearch,
    searchPlaceholder = "Search...",
    emptyStateMessage = "No data found.",
    emptyStateIcon = FaUser,
    itemsPerPage = 10,
    currentPage,
    onPageChange,
    sortConfig,
    onSort,
    actionButtons = [],
    className = "",
    tableClassName = "",
    containerClassName = ""
}) => {
    const EmptyStateIcon = emptyStateIcon;

    if (loading) {
        return <LoadingSpinner message="Loading data..." />;
    }

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

    const pageNumbers = [];
    for (let i = 1; i <= Math.ceil(data.length / itemsPerPage); i++) {
        pageNumbers.push(i);
    }

    return (
        <div className={`data-table-container ${containerClassName}`}>
            <ClientOnlyTooltip />
            
            <div className="data-table-header">
                <div className="table-title">
                    {title}
                </div>
                
                <div className="table-actions">
                    <div className="search-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={onSearchChange}
                        />
                        {searchTerm && (
                            <button className="clear-search" onClick={onClearSearch}>
                                &times;
                            </button>
                        )}
                    </div>

                    {actionButtons.length > 0 && (
                        <div className="action-buttons">
                            {actionButtons.map((button, index) => (
                                <button
                                    key={index}
                                    className={`action-button ${button.className}`}
                                    onClick={button.onClick}
                                    data-tooltip-id="main-tooltip"
                                    data-tooltip-content={button.tooltip}
                                >
                                    <span className="button-icon">{button.icon}</span>
                                    {button.text && <span>{button.text}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {currentItems.length === 0 ? (
                <div className="empty-state">
                    <EmptyStateIcon className="empty-icon" />
                    <div className="empty-message">{emptyStateMessage}</div>
                </div>
            ) : (
                <div className="data-table-content">
                    <table className={`data-table ${tableClassName}`}>
                        <thead>
                            <tr>
                                {columns.map((column) => (
                                    <th 
                                        key={column.key}
                                        onClick={() => column.sortable && onSort(column.key)}
                                        className={`${column.sortable ? 'sortable' : ''} ${
                                            sortConfig.key === column.key ? sortConfig.direction : ''
                                        }`}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((item, index) => (
                                <tr key={item.id || item.observerID || index}>
                                    {columns.map((column) => (
                                        <td key={column.key}>
                                            {column.render ? column.render(item) : item[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pageNumbers.length > 1 && (
                <div className="data-table-footer">
                    <div className="pagination-info">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, data.length)} of {data.length} results
                    </div>
                    <div className="pagination">
                        {pageNumbers.map(number => (
                            <button
                                key={number}
                                className={`page-button ${currentPage === number ? 'active' : ''}`}
                                onClick={() => onPageChange(number)}
                            >
                                {number}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable; 