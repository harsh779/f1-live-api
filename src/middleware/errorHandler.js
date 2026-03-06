const { AxiosError } = require('axios');

function errorHandler(err, req, res, next) {
  if (err instanceof AxiosError) {
    const status = err.response?.status || 502;
    return res.status(status).json({
      error: 'OpenF1 API error',
      message: err.message,
      upstream_status: err.response?.status,
      upstream_data: err.response?.data,
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
