// Wrapper to convert Netlify function format to Vercel
module.exports = function netlifyToVercel(netlifyHandler) {
  return async function vercelHandler(req, res) {
    // Convert Vercel req to Netlify event format
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      body: JSON.stringify(req.body),
      queryStringParameters: req.query,
      path: req.url
    };
    
    const context = {};
    
    try {
      const response = await netlifyHandler(event, context);
      
      // Set headers
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      // Send response
      res.status(response.statusCode || 200);
      
      if (response.body) {
        res.send(response.body);
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Function error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
