import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Button, Typography, Container, Paper, List, ListItem, ListItemText, Snackbar, Alert, Tooltip, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Switch, FormControlLabel, Box, Grid, useMediaQuery, useTheme } from '@mui/material';
import { CloudUpload, Info, GetApp } from '@mui/icons-material'; // Import Info icon
import CSVDisplay from './CSVDisplay';
import QueryTable from './QueryTable';
import { Loader } from 'lucide-react';
const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  cors: {
    origin: 'http://localhost:3000',
  },
});

function App() {
  const [file, setFile] = useState(null);
  const [csvData, setCSVData] = useState('');
  const [progress, setProgress] = useState([]);
  const [queryResult, setQueryResult] = useState('');
  const [headers, setHeaders] = useState([]);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [megaCombinedData, setMegaCombinedData] = useState([]);
  const [csvHeaders, setCSVHeaders] = useState([]);
  const [csvRows, setCSVRows] = useState([]);
  const [fineTuneData, setFineTuneData] = useState({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [isFineTuningLoading, setIsFineTuningLoading] = useState(false);
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
  const [csvError, setCSVError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState(null);

  const [partitionData, setPartitionData] = useState(false);
  const [evaluateReady, setEvaluateReady] = useState(false);
  const [evaluationFile, setEvaluationFile] = useState(null);
  const [evaluationData, setEvaluationData] = useState({ headers: [], rows: [] });
  const [openEvaluateDialog, setOpenEvaluateDialog] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [evaluationCompleted, setEvaluationCompleted] = useState(false);
  const [lastEvaluationResult, setLastEvaluationResult] = useState(null);
  const [message, setMessage] = useState('');
  const [isFirstRunningMessage, setIsFirstRunningMessage] = useState(true);
  const progressRef = useRef(null);
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));
  localStorage.clear()



  useEffect(() => {
    fetchHeaders();

    // Set up socket listeners
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('progress', (data) => {
      // Check for specific fine-tuning messages
      if (data.message === 'Fine-tuning job was cancelled!' || 
          data.message === 'Fine-tuning job completed successfully!') {
        setSnackbarMessage(data.message);
        setSnackbarSeverity(data.message.includes('cancelled') ? 'warning' : 'success');
        setOpenSnackbar(true);
        setIsFineTuningLoading(false);
         // If fine-tuning was successful, refresh the headers
        if (data.message === 'Fine-tuning job completed successfully!') {
          fetchHeaders();
        }
      }
      if (data.message === 'Evaluation completed. Results saved to evaluation_results.json') {
        setEvaluationCompleted(true);
        fetchEvaluationResults();
    
      }
      if(data.message === 'Fine-tuning job status: running') {
        setIsFineTuningLoading(true);
        if (isFirstRunningMessage) {
          setProgress(prev => [...prev, data.message]);
          setIsFirstRunningMessage(false);
        }
      } else {
        setProgress(prev => [...prev, data.message]);
      }


    });

    socket.on('csv_data', (data) => {
      setCSVData(data.data);
    });
    const storedResult = localStorage.getItem('lastEvaluationResult');
    if (storedResult) {
      setLastEvaluationResult(JSON.parse(storedResult));
    }

    // Fetch last evaluation result from server
    fetchLastEvaluationResult();
    return () => {
      socket.off('connect');
      socket.off('progress');
      socket.off('csv_data');
    };
  }, []);
  useEffect(() => {
    if (progressRef.current) {
      setTimeout(() => {
        progressRef.current.scrollTop = progressRef.current.scrollHeight;
      }, 100); // Small delay to ensure content has rendered
    }
  }, [progress]); // This effect runs every time the progress array changes
  const fetchLastEvaluationResult = async () => {
    setIsEvaluationLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/get-last-evaluation-result');
      setTimeout(() => {
      if (response.data) {
        setLastEvaluationResult(response.data);
        localStorage.setItem('lastEvaluationResult', JSON.stringify(response.data));
      } else {
        setLastEvaluationResult(null);
        localStorage.removeItem('lastEvaluationResult');
      }
      setIsEvaluationLoading(false);
    }, 500); // 500ms delay
    } catch (error) {
      setTimeout(() => {
      console.error('Failed to fetch last evaluation result:', error);
      setLastEvaluationResult(null);
      localStorage.removeItem('lastEvaluationResult');
      setIsEvaluationLoading(false);
    }, 500); // 500ms delay
    


    }
  };
  const fetchHeaders = async () => {
    setIsQueryLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/main-csv-headers');
      setTimeout(() => {
        setHeaders(response.data.headers);
        setIsQueryLoading(false);
      }, 500); // 500ms delay
    } catch (error) {
      console.error('Error fetching headers:', error);
      setTimeout(() => {
        if (error.response && error.response.data && error.response.data.error) {
          setError(error.response.data.error);
        } else {
          setError('An error occurred while fetching headers.');
        }
        setHeaders([]);
        setIsQueryLoading(false);
      }, 500); // 500ms delay
    }
  };
  const handleEvaluationDialogClose = () => {
    setEvaluationResult(null);
    setEvaluationCompleted(false);
    if (evaluationResult) {
      setLastEvaluationResult(evaluationResult);
      localStorage.setItem('lastEvaluationResult', JSON.stringify(evaluationResult));
    }
    fetchLastEvaluationResult(); // Add this line to fetch the latest results
  };

  const renderEvaluationResults = (results) => {
    if (!results) return null;

    return (
      <>
        <Typography variant="h6" gutterBottom>Model Information</Typography>
        <Typography variant="body1">Model Name: {results.model_name}</Typography>


        <Typography variant="h6" gutterBottom>Overall Results</Typography>
        <Typography variant="body1">Overall Accuracy: {(results.overall_accuracy * 100).toFixed(2)}%</Typography>
        <Typography variant="body1">Total Correct Items: {results.total_correct_items}</Typography>
        <Typography variant="body1">Total Items: {results.total_items}</Typography>
        <Typography variant="body1">Missing Items: {results.total_missing_items}</Typography>
        <Typography variant="body1">Extra Items: {results.total_extra_items}</Typography>

        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Per-Field Accuracy</Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell align="right">Accuracy</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(results.per_field_accuracy).map(([field, accuracy]) => (
                <TableRow key={field}>
                  <TableCell component="th" scope="row">{field}</TableCell>
                  <TableCell align="right">{(accuracy * 100).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Individual Comparisons</Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Comparison</TableCell>
                    <TableCell align="right">Accuracy</TableCell>
                    <TableCell align="right">Correct Items</TableCell>
                    <TableCell align="right">Total Items</TableCell>
                    <TableCell align="right">Missing Items</TableCell>
                    <TableCell align="right">Extra Items</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.individual_comparisons.map((comparison, index) => (
                    <TableRow key={index}>
                      <TableCell component="th" scope="row">{index + 1}</TableCell>
                      <TableCell align="right">{(comparison.accuracy * 100).toFixed(2)}%</TableCell>
                      <TableCell align="right">{comparison.correct_items}</TableCell>
                      <TableCell align="right">{comparison.total_items}</TableCell>
                      <TableCell align="right">{comparison.missing_items}</TableCell>
                      <TableCell align="right">{comparison.extra_items}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

      </>
    );
  };
  const handleDownloadReport = async () => {
    try {
      const response = await axios.get('http://localhost:5000/download-evaluation-report', {
        responseType: 'blob', // Important for file downloads
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'evaluation_report.json'); // or .csv if you prefer
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Error downloading report:', error);
      setSnackbarMessage('Failed to download evaluation report');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    }
  };
  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleQuery = async (query) => {
    setIsQueryLoading(true);
    try {
      const formData = new FormData();
      formData.append('user_query', query);
      const response = await axios.post('http://localhost:5000/query', formData);
      setQueryResult(response.data);
      setSnackbarMessage('Query submitted successfully');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    } catch (error) {
      console.error('Query failed:', error);
      setSnackbarMessage('Query submission failed');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    }finally {
      setIsQueryLoading(false);
    }
  };
  
  const handlePartitionToggle = (event) => {
    setPartitionData(event.target.checked);
  };


  const handleFineTune = useCallback(async () => {
    console.log('handleFineTune called');
    setCSVError(null);
    setIsFineTuningLoading(true);
    setFineTuneData({ headers: [], rows: [] }); // Reset data before fetching
    
    try {
      console.log('Fetching CSV data...');
      const response = await axios.get('http://localhost:5000/get-csv-data', {
        transformResponse: [(data) => {
          // Return the raw string data
          return data;
        }]
      });
      
      console.log('Response data type:', typeof response.data);
      console.log('Response data preview (first 1000 characters):', response.data.substring(0, 1000));
      console.log('Response data preview (last 1000 characters):', response.data.substring(response.data.length - 1000));
      
      let parsedData;
      try {
        parsedData = JSON.parse(response.data);
      } catch (e) {
        console.error('Error parsing response data:', e);
        console.error('Error location:', response.data.substring(e.pos - 50, e.pos + 50));
        setCSVError('Error parsing server response. Please check the console for details.');
        return;
      }
      
      console.log('Parsed data (first 5 rows):', parsedData.rows.slice(0, 5));
      
      if (parsedData.error) {
        console.log('Error in CSV data:', parsedData.error);
        setCSVError(parsedData.error);
      } else if (
        Array.isArray(parsedData.headers) && 
        Array.isArray(parsedData.rows) &&
        parsedData.rows.length > 0 &&
        typeof parsedData.rows[0] === 'object'
      ) {
        console.log('Setting fineTuneData...');
        setFineTuneData({
          headers: parsedData.headers,
          rows: parsedData.rows
        });
        console.log('Opening dialog...');
        setOpenDialog(true);
      } else {
        console.log('Unexpected data format');
        setCSVError('Received data is not in the expected format. Please check the console for details.');
      }
    } catch (error) {
      console.error('Failed to fetch CSV data:', error);
      setCSVError('Failed to fetch CSV data. Please try again.');
    } finally {
      setIsFineTuningLoading(false);
      console.log('handleFineTune completed');
    }

    
  }, []);

  // Use useEffect to log state changes
  useEffect(() => {
    console.log('fineTuneData updated:', fineTuneData);
    console.log('fineTuneData headers length:', fineTuneData.headers.length);
    console.log('fineTuneData rows length:', fineTuneData.rows.length);
  }, [fineTuneData]);
  
  useEffect(() => {
    console.log('Dialog open state changed:', openDialog);
  }, [openDialog]);

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={fineTuneData.headers.length || 1} align="center">
            <CircularProgress />
          </TableCell>
        </TableRow>
      );
    }

    if (csvError) {
      return (
        <TableRow>
          <TableCell colSpan={fineTuneData.headers.length || 1} align="center">
            <Typography color="error">{csvError}</Typography>
          </TableCell>
        </TableRow>
      );
    }

    if (!fineTuneData.rows || fineTuneData.rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={fineTuneData.headers.length || 1} align="center">
            <Typography>No data available</Typography>
          </TableCell>
        </TableRow>
      );
    }

    return fineTuneData.rows.map((row, rowIndex) => (
      <TableRow key={rowIndex}>
        {fineTuneData.headers.map((header, cellIndex) => (
          <TableCell key={cellIndex}>{formatCellContent(row[header])}</TableCell>
        ))}
      </TableRow>
    ));
  };

  const formatCellContent = (content) => {
    if (content === null || content === undefined || (typeof content === 'number' && isNaN(content))) {
      return '-';
    }
    return String(content);
  };

  const formatHeader = (header) => {
    return header.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };
  

  const confirmFineTune = async () => {
    setOpenDialog(false);
    try {
      const response = await axios.post('http://localhost:5000/finetune', {
        partitionData: partitionData
      });
      console.log(response.data);
      setEvaluateReady(partitionData);
    } catch (error) {   
      console.error('Fine-tuning failed:', error);
    }
  };

  const handleReset = () => {
    setProgress([]);
    setCSVData('');
    setQueryResult('');
  };

  const handleClearFields = () => {
    setSnackbarMessage('All fields have been cleared');
    setSnackbarSeverity('info');
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSnackbar(false);
  };
  const handleEvaluationFileUpload = (event) => {
    setEvaluationFile(event.target.files[0]);
    setEvaluateReady(true);
  };

  const handleEvaluate = async () => {
    setIsEvaluationLoading(true);
    if (evaluationFile) {
      console.log("Using uploaded evaluation file");
      // If a file was uploaded, use that for evaluation
      const formData = new FormData();
      formData.append('file', evaluationFile);
      try {
        const response = await axios.post('http://localhost:5000/upload-evaluation', formData);
        setEvaluationData(response.data);
        console.log('Evaluation file uploaded successfully:', response.data);
      } catch (error) {
        console.error('Evaluation file upload failed:', error.response || error.message);
        setSnackbarMessage('Evaluation file upload failed');
        setSnackbarSeverity('error');
        setOpenSnackbar(true);
        return;
      }
    } else if (!partitionData) {
      // If no file was uploaded and data wasn't partitioned, we can't evaluate
      setSnackbarMessage('No evaluation data available');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    } else {
      // Use partitioned data
      try {
        const response = await axios.get('http://localhost:5000/get-evaluation-data');
        setEvaluationData(response.data);
        console.log('Partitioned evaluation data fetched successfully:', response.data);
      } catch (error) {
        console.error('Failed to fetch partitioned evaluation data:', error.response || error.message);
        setSnackbarMessage('Failed to fetch evaluation data');
        setSnackbarSeverity('error');
        setOpenSnackbar(true);
        return;
      }finally {
        setIsEvaluationLoading(false);
      }
    }
  
    setOpenEvaluateDialog(true);
  };
  

  const confirmEvaluation = async () => {
    setOpenEvaluateDialog(false);
    try {
      await axios.post('http://localhost:5000/evaluate', {
        evaluationData: evaluationFile ? evaluationData : 'use_partitioned_data'
      });
      setSnackbarMessage('Evaluation started');
      setSnackbarSeverity('info');
      setOpenSnackbar(true);
    } catch (error) {
      console.error('Evaluation failed to start:', error);
      setSnackbarMessage('Evaluation failed to start');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    }
    // Reset evaluation state
    setEvaluateReady(false);
    setEvaluationFile(null);
    setEvaluationData({ headers: [], rows: [] });
  };

  const fetchEvaluationResults = async () => {
    try {
      const response = await axios.get('http://localhost:5000/get-evaluation-results');
      setEvaluationResult(response.data);
      setOpenEvaluateDialog(false);
      setSnackbarMessage('Evaluation completed');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    } catch (error) {
      console.error('Failed to fetch evaluation results:', error);
      setSnackbarMessage('Failed to fetch evaluation results');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    }
  };

  const renderContent = () => (
    <>
      {/* Query Section */}
      <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
        <Typography variant="h6" gutterBottom>
          Query Specifications
          <Tooltip title="Fill in the table to query specifications and get predictions from the model.">
            <Info sx={{ marginLeft: '8px', color: 'grey' }} />
          </Tooltip>
        </Typography>
        {isQueryLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <CircularProgress />
          </Box>
        ) : headers.length > 0 ? (
          <QueryTable 
            headers={headers} 
            onQuery={handleQuery} 
            queryResult={queryResult} 
            onClearFields={handleClearFields}
          />
        ) : (
          <Typography variant="body1" color="error" sx={{ marginTop: '20px' }}>
            Please train your model first to enable querying. Once trained, you'll be able to input specifications and get predictions here.
          </Typography>
        )}
      </Paper>

      {/* File Upload Section */}
      <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Upload Training Files
              <Tooltip title="Upload PDF files to extract data and train the model.">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  id="raised-button-file"
                  type="file"
                  onChange={handleFileChange}
                />
                <label htmlFor="raised-button-file">
                  <Button variant="contained" component="span" startIcon={<CloudUpload />}>
                    Choose PDF
                  </Button>
                </label>
                <Button variant="contained" color="primary" onClick={handleUpload} disabled={!file} sx={{ marginLeft: '10px' }}>
                  Upload
                </Button>
              </Box>
              {file && (
                <Typography variant="body2" color="text.secondary">
                  Selected file: {file.name}
                </Typography>
              )}
            </Box>
          </Paper>

      {/* Progress Section */}
      <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px', maxHeight: '200px', overflow: 'auto' }}
            ref={progressRef}
          >
            <Typography variant="h6" gutterBottom>
              Progress
              <Tooltip title="View the progress of file uploads and model training.">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            <List>
              {progress.map((message, index) => (
                <ListItem key={index}>
                  <ListItemText primary={message} />
                  {isFineTuningLoading && index === progress.length - 1 && <CircularProgress size={20} />}
                </ListItem>
              ))}
            </List>
          </Paper>

      {/* Fine-tuning Section */}
      <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Train Model
              <Tooltip title="Fine-tune the model with uploaded training data">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            <FormControlLabel
              control={<Switch checked={partitionData} onChange={handlePartitionToggle} />}
              label="Partition data for evaluation"
            />
            <Button variant="contained" color="secondary" onClick={handleFineTune} sx={{ marginLeft: '10px' }}>
              Fine-tune
            </Button>
        </Paper>



      {/* Evaluation Section */}
      <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Evaluation
              <Tooltip title="Evaluate the model with partitioned or uploaded data and view the latest evaluation results to understand model performance.">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="evaluation-file-upload"
                  type="file"
                  onChange={handleEvaluationFileUpload}
                />
                <label htmlFor="evaluation-file-upload">
                  <Button variant="contained" component="span" startIcon={<CloudUpload />}>
                    Upload Evaluation File
                  </Button>
                </label>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleEvaluate} 
                  disabled={!evaluateReady}
                >
                  Evaluate
                </Button>
              </Box>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={handleDownloadReport}
                startIcon={<GetApp />}
                disabled={!lastEvaluationResult}
              >
                Download Report
              </Button>
            </Box>
            {evaluationFile && (
              <Typography variant="body2" color="text.secondary">
                Selected file: {evaluationFile.name}
              </Typography>
            )}
            {isEvaluationLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <CircularProgress />
              </Box>
            ) :lastEvaluationResult ? (
              <Paper elevation={2} sx={{ padding: '20px', marginTop: '20px' }}>
                <Typography variant="h6" gutterBottom>Latest Model Evaluation Results</Typography>
                {renderEvaluationResults(lastEvaluationResult)}
              </Paper>
            ): (
              <Paper elevation={2} sx={{ padding: '20px', marginTop: '20px' }}>
                <Typography variant="body1">Please evaluate your model to show the results.</Typography>
              </Paper>
            )}
        </Paper>
    </>
  );


  return (
    <Container maxWidth={isLargeScreen ? "xl" : "md"}>
      <Typography 
        variant="h3" 
        component="h1" 
        gutterBottom 
        sx={{ fontWeight: 'bold', textAlign: 'center', margin: '20px 0' }}
      >
        QueryModel AI
      </Typography>
      {isLargeScreen ? (
      <Grid container spacing={3}>
         {/* Query Section - Full Width */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Query Specifications
              <Tooltip title="Fill in the table to query specifications and get predictions from the model.">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            {isQueryLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <CircularProgress />
              </Box>
            ) : headers.length > 0 ? (
              <QueryTable 
                headers={headers} 
                onQuery={handleQuery} 
                queryResult={queryResult} 
                onClearFields={handleClearFields}
              />
            ) : (
              <Typography variant="body1" color="error" sx={{ marginTop: '20px' }}>
                Please train your model first to enable querying. Once trained, you'll be able to input specifications and get predictions here.
              </Typography>
            )}
          </Paper>
        </Grid>
        {/* Left Column */}
        <Grid item xs={12} lg={6}>
          {/* File Upload Section */}
          <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Upload Training Files
              <Tooltip title="Upload PDF files to extract data and train the model.">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  id="raised-button-file"
                  type="file"
                  onChange={handleFileChange}
                />
                <label htmlFor="raised-button-file">
                  <Button variant="contained" component="span" startIcon={<CloudUpload />}>
                    Choose PDF
                  </Button>
                </label>
                <Button variant="contained" color="primary" onClick={handleUpload} disabled={!file} sx={{ marginLeft: '10px' }}>
                  Upload
                </Button>
              </Box>
              {file && (
                <Typography variant="body2" color="text.secondary">
                  Selected file: {file.name}
                </Typography>
              )}
            </Box>
          </Paper>

          {/* Progress Section */}
          <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px', maxHeight: '200px', overflow: 'auto' }}
            ref={progressRef}
          >
            <Typography variant="h6" gutterBottom>
              Progress
              <Tooltip title="View the progress of file uploads and model training.">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            <List>
              {progress.map((message, index) => (
                <ListItem key={index}>
                  <ListItemText primary={message} />
                  {isFineTuningLoading && index === progress.length - 1 && <CircularProgress size={20} />}
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* Fine-tuning Section */}
          <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Train Model
              <Tooltip title="Fine-tune the model with uploaded training data">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            <FormControlLabel
              control={<Switch checked={partitionData} onChange={handlePartitionToggle} />}
              label="Partition data for evaluation"
            />
            <Button variant="contained" color="secondary" onClick={handleFineTune} sx={{ marginLeft: '10px' }}>
              Fine-tune
            </Button>
          </Paper>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} lg={6}>

          {/* Evaluation Section */}
          <Paper elevation={3} sx={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Evaluation
              <Tooltip title="Evaluate the model with partitioned or uploaded data and view the latest evaluation results to understand model performance.">
                <Info sx={{ marginLeft: '8px', color: 'grey' }} />
              </Tooltip>
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="evaluation-file-upload"
                  type="file"
                  onChange={handleEvaluationFileUpload}
                />
                <label htmlFor="evaluation-file-upload">
                  <Button variant="contained" component="span" startIcon={<CloudUpload />}>
                    Upload Evaluation File
                  </Button>
                </label>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleEvaluate} 
                  disabled={!evaluateReady}
                >
                  Evaluate
                </Button>
              </Box>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={handleDownloadReport}
                startIcon={<GetApp />}
                disabled={!lastEvaluationResult}
              >
                Download Report
              </Button>
            </Box>
            {evaluationFile && (
              <Typography variant="body2" color="text.secondary">
                Selected file: {evaluationFile.name}
              </Typography>
            )}
           {isEvaluationLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <CircularProgress />
              </Box>
            ) : lastEvaluationResult ? (
              <Paper elevation={2} sx={{ padding: '20px', marginTop: '20px' }}>
                <Typography variant="h6" gutterBottom>Last Evaluation Results</Typography>
                {renderEvaluationResults(lastEvaluationResult)}
              </Paper>
            ): (
              <Paper elevation={2} sx={{ padding: '20px', marginTop: '20px' }}>
                <Typography variant="body1">Please evaluate your model to show the results.</Typography>
              </Paper>
            )}
          </Paper>
        </Grid>
      </Grid>
      ) : (
        renderContent()
      )}

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Confirm Fine-tuning</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" gutterBottom>
            Please review the data from <code>mega_combined.csv</code> before confirming to train the model:
          </Typography>
          {isLoading ? (
            <CircularProgress />
          ) : csvError ? (
            <Typography color="error">{csvError}</Typography>
          ) : (
            <>
            {console.log('Rendering table with data:', fineTuneData)}
            <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table stickyHeader aria-label="CSV data table">
                <TableHead>
                  <TableRow>
                    {fineTuneData.headers.map((header, index) => (
                      <TableCell key={index}>{header === '' ? `Column${index + 1}` : formatHeader(header)}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fineTuneData.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {fineTuneData.headers.map((header, cellIndex) => (
                        <TableCell key={cellIndex}>
                          {formatCellContent(row[header])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="primary">Cancel</Button>
          <Button 
            onClick={confirmFineTune} 
            color="secondary" 
            disabled={isLoading || csvError !== null || fineTuneData.rows.length === 0}
          >
            Confirm and Train
          </Button>
        </DialogActions>
      </Dialog>

      {/* Evaluation Dialog */}
      <Dialog 
        open={openEvaluateDialog} 
        onClose={() => setOpenEvaluateDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Confirm Evaluation</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" gutterBottom>
            Please review the evaluation data before confirming:
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
            <Table stickyHeader aria-label="Evaluation data table">
              <TableHead>
                <TableRow>
                  {evaluationData.headers.map((header, index) => (
                    <TableCell key={index}>{header === '' ? `Column${index + 1}` : formatHeader(header)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {evaluationData.rows.slice(0, 10).map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {evaluationData.headers.map((header, cellIndex) => (
                      <TableCell key={cellIndex}>
                        {formatCellContent(row[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEvaluateDialog(false)} color="primary">Cancel</Button>
          <Button onClick={confirmEvaluation} color="secondary">
            Confirm and Evaluate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Evaluation Dialog */}
      <Dialog 
        open={!!evaluationResult && evaluationCompleted} 
        onClose={handleEvaluationDialogClose} 
        maxWidth="md" 
        fullWidth
      >
          <DialogTitle>Evaluation Results</DialogTitle>
        <DialogContent>
          {renderEvaluationResults(evaluationResult)}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEvaluationDialogClose} color="primary">Close</Button>
        </DialogActions>
      </Dialog>
    
    {/* Open Manual Dialog Button  
    <Button onClick={() => setOpenDialog(true)}>Open Dialog Manually</Button>
    */}
      {/* Snackbar for alerts */}
      <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
    
  );
}

export default App;
