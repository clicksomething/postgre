const LinearProgrammingAssignmentService = require('./src/services/linearProgrammingAssignmentService');

async function testGLPKQuick() {
  try {
    console.log('Testing GLPK model building...');
    
    const service = new LinearProgrammingAssignmentService();
    
    // Create minimal test data
    const testData = {
      exams: [
        { id: 1, date: new Date('2024-01-01'), startTime: '09:00', endTime: '11:00', startMin: 540, endMin: 660 },
        { id: 2, date: new Date('2024-01-01'), startTime: '14:00', endTime: '16:00', startMin: 840, endMin: 960 }
      ],
      observers: [
        { id: 1, name: 'Dr. Smith', isDoctor: true, maxAssignments: 5, timeslots: [{ day: 'monday', startTime: '08:00', endTime: '17:00' }] },
        { id: 2, name: 'Dr. Jones', isDoctor: true, maxAssignments: 5, timeslots: [{ day: 'monday', startTime: '08:00', endTime: '17:00' }] },
        { id: 3, name: 'Secretary A', isDoctor: false, maxAssignments: 5, timeslots: [{ day: 'monday', startTime: '08:00', endTime: '17:00' }] },
        { id: 4, name: 'Secretary B', isDoctor: false, maxAssignments: 5, timeslots: [{ day: 'monday', startTime: '08:00', endTime: '17:00' }] }
      ]
    };
    
    console.log('Building GLPK model...');
    const model = service.buildGLPKModel(testData);
    
    console.log('Model built successfully!');
    console.log('Variables:', model.objective.vars.length);
    console.log('Constraints:', model.subjectTo.length);
    console.log('Binaries:', model.binaries.length);
    
    console.log('Solving with GLPK...');
    const solution = await service.solveGLPK(model);
    
    console.log('Solution:', solution);
    
    if (solution && solution.result) {
      console.log('Objective value:', solution.result.z);
      console.log('Variables with value > 0:', Object.entries(solution.result.vars).filter(([k,v]) => v > 0));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testGLPKQuick(); 