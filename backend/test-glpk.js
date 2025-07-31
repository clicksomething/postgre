const LinearProgrammingAssignmentService = require('./src/services/linearProgrammingAssignmentService');

async function testGLPK() {
  const service = new LinearProgrammingAssignmentService();
  
  try {
    // Test with a small set of exam IDs
    const examIds = [2454, 2463, 2467, 2451, 2469, 2488, 2474, 2460];
    
    console.log('Testing GLPK algorithm with exam IDs:', examIds);
    
    const result = await service.assignObserversWithLP(examIds);
    
    console.log('GLPK Algorithm completed successfully!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('Error testing GLPK algorithm:', error);
  }
}

testGLPK(); 