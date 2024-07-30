import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, TextField, Snackbar, Alert, Box } from '@mui/material';

function QueryTable({ headers, onQuery, queryResult }) {
  const [queryData, setQueryData] = useState(
    headers.reduce((acc, header) => ({ ...acc, [header]: '' }), {})
  );
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('error');
  const [copySuccess, setCopySuccess] = useState('');

  const inputRefs = useRef({});

  const setInputRef = useCallback((header) => (element) => {
    inputRefs.current[header] = element;
  }, []);

  useEffect(() => {
    if (queryResult) {
      const resultPairs = queryResult.split(', ');
      const newQueryData = { ...queryData };
      resultPairs.forEach(pair => {
        const [key, value] = pair.split(': ');
        if (headers.includes(key)) {
          newQueryData[key] = value;
        }
      });
      setQueryData(newQueryData);
    }
  }, [queryResult, headers]);

  const handleInputChange = (header) => (event) => {
    setQueryData(prev => ({ ...prev, [header]: event.target.value }));
    adjustInputWidth(header);
  };

  const adjustInputWidth = (header) => {
    const input = inputRefs.current[header];
    if (input) {
      input.style.width = 'auto';
      input.style.width = `${input.scrollWidth}px`;
    }
  };

  const handleSubmit = () => {
    const filledFields = Object.entries(queryData).filter(([_, value]) => value.trim() !== '');

    if (filledFields.length < 2) {
      setSnackbarMessage('Please fill in at least two fields.');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    if (filledFields.length === headers.length) {
      const recommendedFields = headers.slice(0, -1).join(', ');
      setSnackbarMessage(`Please leave at least one field empty. Recommended: Fill ${recommendedFields} and leave the last field empty.`);
      setSnackbarSeverity('warning');
      setOpenSnackbar(true);
      return;
    }

    const query = filledFields
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    onQuery(query);

    setSnackbarMessage('Query submitted successfully!');
    setSnackbarSeverity('success');
    setOpenSnackbar(true);
  };

  const handleClear = () => {
    setQueryData(headers.reduce((acc, header) => ({ ...acc, [header]: '' }), {}));
    headers.forEach(header => {
      if (inputRefs.current[header]) {
        inputRefs.current[header].style.width = 'auto';
      }
    });
    setSnackbarMessage('All fields have been cleared.');
    setSnackbarSeverity('info');
    setOpenSnackbar(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(queryResult).then(() => {
      setSnackbarMessage('Copied to clipboard!');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    }).catch(() => {
      setSnackbarMessage('Failed to copy!');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    });
  };
    

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSnackbar(false);
  };
  const [copyOpenSnackbar, setCopyOpenSnackbar] = useState(false);
  const [copySnackbarMessage, setCopySnackbarMessage] = useState('');
  const [copySnackbarSeverity, setCopySnackbarSeverity] = useState('success');
  const handleCloseCopySnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setCopyOpenSnackbar(false);
  };
  
  return (
    <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="query table">
          <TableHead>
            <TableRow>
              {headers.map((header, index) => (
                <TableCell key={index}>{header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              {headers.map((header, index) => (
                <TableCell key={index}>
                  <TextField 
                    fullWidth 
                    variant="standard"
                    value={queryData[header]} 
                    onChange={handleInputChange(header)}
                    inputRef={setInputRef(header)}
                    InputProps={{
                      disableUnderline: true,
                      sx: {
                        fontSize: '1rem',
                        padding: '4px',
                        '&:hover': {
                          backgroundColor: '#f0f0f0',
                        },
                      },
                    }}
                    sx={{
                      minWidth: '100px',
                      '& .MuiInputBase-root': {
                        width: 'auto',
                        display: 'inline-block',
                      },
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Submit Query
        </Button>
        <Button variant="outlined" color="secondary" onClick={handleClear}>
          Clear All
        </Button>
        <Button variant="outlined" color="primary" onClick={handleCopy}>
          Copy Response
        </Button>
      </Box>
      <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>


    </Paper>
  );
}

export default QueryTable;
