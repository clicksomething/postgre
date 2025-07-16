export const getScoreColor = (score) => {
    const value = parseFloat(score);
    if (value >= 90) return '#4caf50';
    if (value >= 80) return '#8bc34a';
    if (value >= 70) return '#ff9800';
    if (value >= 60) return '#ff5722';
    return '#f44336';
}; 