const formatLastLogin = (lastLogin) => {
  if (!lastLogin) return 'Never';

  const loginTime = new Date(lastLogin);

  return loginTime.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

module.exports = { formatLastLogin };