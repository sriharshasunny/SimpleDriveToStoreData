const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testUpload() {
    try {
        const filePath = path.join(__dirname, 'test_file.txt');
        fs.writeFileSync(filePath, 'This is a test file content.');

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        // Test with root folder (null)
        form.append('folderId', 'null');

        console.log('Attempting upload...');
        const response = await axios.post('http://localhost:3001/api/upload', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('Upload Success!', response.status, response.data);

        // Clean up
        fs.unlinkSync(filePath);
    } catch (error) {
        console.error('Upload Failed:', error.response ? error.response.data : error.message);
    }
}

testUpload();
