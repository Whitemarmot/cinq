/**
 * Netlify Function wrapper for birthday-reminders API
 */

const handler = require('../../api/birthday-reminders.js');

exports.handler = async (event, context) => {
    // Create Express-like req/res objects
    const req = {
        method: event.httpMethod,
        url: event.path + (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : ''),
        headers: event.headers,
        body: event.body,
        query: event.queryStringParameters || {}
    };

    if (event.body) {
        try {
            req.body = JSON.parse(event.body);
        } catch (e) {
            req.body = event.body;
        }
    }

    let statusCode = 200;
    let responseHeaders = {};
    let responseBody = '';

    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        json: (data) => {
            responseHeaders['Content-Type'] = 'application/json';
            responseBody = JSON.stringify(data);
            return res;
        },
        send: (data) => {
            responseBody = data;
            return res;
        },
        header: (key, value) => {
            responseHeaders[key] = value;
            return res;
        }
    };

    try {
        await handler.default(req, res);
        
        return {
            statusCode,
            headers: responseHeaders,
            body: responseBody
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};