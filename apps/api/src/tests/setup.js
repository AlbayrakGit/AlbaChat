// Test ortamı için environment değişkenleri
process.env.JWT_SECRET = 'test_jwt_secret_min_32_chars_long_for_tests';
process.env.REFRESH_SECRET = 'test_refresh_secret_min_32_chars_long_for_tests';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
