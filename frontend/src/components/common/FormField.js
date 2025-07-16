import React from 'react';
import './FormField.scss';

const FormField = ({
    label,
    name,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    error,
    disabled = false,
    className = '',
    options = [], // For select fields
    rows = 3, // For textarea
    ...props
}) => {
    const fieldId = `field-${name}`;
    
    const renderField = () => {
        switch (type) {
            case 'select':
                return (
                    <select
                        id={fieldId}
                        name={name}
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                        className={`form-field-input ${error ? 'error' : ''}`}
                        {...props}
                    >
                        <option value="">{placeholder || 'Select an option'}</option>
                        {options.map((option, index) => (
                            <option key={index} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );
            
            case 'textarea':
                return (
                    <textarea
                        id={fieldId}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={rows}
                        className={`form-field-input ${error ? 'error' : ''}`}
                        {...props}
                    />
                );
            
            case 'checkbox':
                return (
                    <div className="checkbox-wrapper">
                        <input
                            id={fieldId}
                            type="checkbox"
                            name={name}
                            checked={value}
                            onChange={onChange}
                            disabled={disabled}
                            className={`form-field-input ${error ? 'error' : ''}`}
                            {...props}
                        />
                        <label htmlFor={fieldId} className="checkbox-label">
                            {label}
                        </label>
                    </div>
                );
            
            default:
                return (
                    <input
                        id={fieldId}
                        type={type}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                        className={`form-field-input ${error ? 'error' : ''}`}
                        {...props}
                    />
                );
        }
    };

    // Don't render label for checkbox as it's handled differently
    if (type === 'checkbox') {
        return (
            <div className={`form-field ${className}`}>
                {renderField()}
                {error && <div className="field-error">{error}</div>}
            </div>
        );
    }

    return (
        <div className={`form-field ${className}`}>
            <label htmlFor={fieldId} className="field-label">
                {label}
                {required && <span className="required">*</span>}
            </label>
            {renderField()}
            {error && <div className="field-error">{error}</div>}
        </div>
    );
};

export default FormField; 