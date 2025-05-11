document.addEventListener('DOMContentLoaded', () => {
  // Initialize Socket.io connection
  const socket = io();
  
  // Keep track of the current active panels and their assignments
  let activePanels = 1;
  let panelAssignments = {};
  let intervalIds = [];
  
  // DOM elements
  const dashboardPanels = document.getElementById('dashboard-panels');
  const assignmentSelectors = document.getElementById('assignment-selectors');
  const layoutButtons = document.querySelectorAll('.layout-btn');
  
  // Fetch available assignments
  fetchAssignments();
  
  // Set up event listeners for layout buttons
  layoutButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Update layout buttons state
      layoutButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Get layout value from button id
      const layout = button.id.split('-')[1];
      
      // Update layout class on dashboard panels
      dashboardPanels.className = `dashboard-panels layout-${layout}`;
      
      // Update number of active panels
      activePanels = parseInt(layout);
      
      // Update assignment selectors
      updateAssignmentSelectors();
    });
  });
  
  // Function to fetch assignments from the API
  async function fetchAssignments() {
    try {
      const response = await fetch('/api/assignments');
      const assignments = await response.json();
      
      // Update all assignment selectors with the available assignments
      updateSelectorsWithAssignments(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  }
  
  // Function to update all assignment selectors with the available assignments
  function updateSelectorsWithAssignments(assignments) {
    const selectors = document.querySelectorAll('.panel-assignment-select');
    
    selectors.forEach(selector => {
      // Clear existing options except the first one
      while (selector.options.length > 1) {
        selector.remove(1);
      }
      
      // Add assignment options
      assignments.forEach(assignment => {
        const option = document.createElement('option');
        option.value = assignment.assignment_id;
        option.textContent = assignment.assignment_name;
        selector.appendChild(option);
      });
      
      // Add event listener for assignment selection
      if (!selector.hasAttribute('data-listener-attached')) {
        selector.addEventListener('change', handleAssignmentSelection);
        selector.setAttribute('data-listener-attached', 'true');
      }
    });
  }
  
  // Function to update the assignment selectors based on the active layout
  function updateAssignmentSelectors() {
    // Clear all existing selectors
    assignmentSelectors.innerHTML = '';
    
    // Add selector for each active panel
    for (let i = 0; i < activePanels; i++) {
      const selectorDiv = document.createElement('div');
      selectorDiv.className = 'panel-selector';
      selectorDiv.dataset.panel = i;
      
      const label = document.createElement('label');
      label.htmlFor = `panel-${i}-select`;
      label.textContent = `Panel ${i + 1}:`;
      
      const select = document.createElement('select');
      select.id = `panel-${i}-select`;
      select.className = 'panel-assignment-select';
      
      // Add default empty option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select an assignment...';
      select.appendChild(defaultOption);
      
      // Set the current selection if this panel already has an assignment
      if (panelAssignments[i]) {
        select.value = panelAssignments[i];
      }
      
      selectorDiv.appendChild(label);
      selectorDiv.appendChild(select);
      assignmentSelectors.appendChild(selectorDiv);
    }
    
    // Update the selectors with assignments
    fetchAssignments();
    
    // Hide panels that are not active
    const panels = document.querySelectorAll('.dashboard-panel');
    panels.forEach((panel, index) => {
      if (index < activePanels) {
        panel.style.display = 'flex';
      } else {
        panel.style.display = 'none';
      }
    });
  }
  
  // Handle assignment selection
  function handleAssignmentSelection(event) {
    const select = event.target;
    const panelIndex = parseInt(select.closest('.panel-selector').dataset.panel);
    const assignmentId = select.value;
    
    // Update our tracking object
    if (assignmentId) {
      panelAssignments[panelIndex] = assignmentId;
      loadAssignmentPanel(panelIndex, assignmentId);
    } else {
      delete panelAssignments[panelIndex];
      clearPanel(panelIndex);
    }
  }
  
  // Load assignment data into a panel
  async function loadAssignmentPanel(panelIndex, assignmentId) {
    try {
      // Fetch assignment details
      const assignmentResponse = await fetch(`/api/assignments`);
      const assignments = await assignmentResponse.json();
      const assignment = assignments.find(a => a.assignment_id == assignmentId);
      
      if (!assignment) {
        throw new Error(`Assignment with ID ${assignmentId} not found`);
      }
      
      // Fetch students for this assignment
      const studentsResponse = await fetch(`/api/assignment/${assignmentId}/students`);
      const students = await studentsResponse.json();
      
      // Update the panel with the data
      updatePanel(panelIndex, assignment, students);
      
      // Set up real-time updates for this panel
      setupRealTimeUpdates(panelIndex, assignmentId);
    } catch (error) {
      console.error(`Error loading assignment ${assignmentId} for panel ${panelIndex}:`, error);
    }
  }
  
  // Update a panel with assignment and student data
  function updatePanel(panelIndex, assignment, students) {
    const panel = document.getElementById(`panel-${panelIndex}`);
    
    // Create panel content
    let html = `
      <div class="panel-header">
        <h3>${assignment.assignment_name}</h3>
        <div class="panel-stats">
          <span>${students.length} students</span>
        </div>
      </div>
      <div class="panel-content">
        <div class="panel-students" id="panel-${panelIndex}-students">
    `;
    
    // Add student cards
    if (students && students.length > 0) {
      students.forEach(student => {
        const currentQuestion = student.most_current_question_index || 0;
        const totalQuestions = student.number_of_questions || 0;
        const correctPercentage = student.percent_correct ? Math.round(student.percent_correct) : 0;
        
        const correctQuestions = student.number_of_questions_correct || 0;
        const incorrectQuestions = (currentQuestion - correctQuestions) > 0 ? (currentQuestion - correctQuestions) : 0;
        const remainingQuestions = totalQuestions - currentQuestion > 0 ? (totalQuestions - currentQuestion) : 0;
        
        const correctWidth = totalQuestions > 0 ? (correctQuestions / totalQuestions) * 100 : 0;
        const incorrectWidth = totalQuestions > 0 ? (incorrectQuestions / totalQuestions) * 100 : 0;
        const remainingWidth = totalQuestions > 0 ? (remainingQuestions / totalQuestions) * 100 : 0;
        
        html += `
          <div class="student-card" data-student-id="${student.student_id}">
            <div class="student-info">
              <h3>${student.full_name}</h3>
              <div class="score">${student.total_score || 0}</div>
            </div>
            <div class="progress-info">
              <div class="progress-text">
                <span>${currentQuestion}/${totalQuestions}/${correctPercentage}%</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar">
                  <div class="progress-segment correct" style="width: ${correctWidth}%"></div>
                  <div class="progress-segment incorrect" style="width: ${incorrectWidth}%"></div>
                  <div class="progress-segment remaining" style="width: ${remainingWidth}%"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      });
    } else {
      html += `
        <div class="no-data">
          <p>No student data available for this assignment.</p>
        </div>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
    
    panel.innerHTML = html;
  }
  
  // Set up real-time updates for a panel
  function setupRealTimeUpdates(panelIndex, assignmentId) {
    // Clear any existing interval for this panel
    if (intervalIds[panelIndex]) {
      clearInterval(intervalIds[panelIndex]);
    }
    
    // Start watching this assignment for updates
    socket.emit('watchAssignment', assignmentId);
    
    // Handle updates from the server
    socket.on('assignmentUpdate', (data) => {
      if (data.assignmentId == assignmentId && panelAssignments[panelIndex] == assignmentId) {
        updatePanelStudents(panelIndex, data.students);
      }
    });
  }
  
  // Update just the students part of a panel
  function updatePanelStudents(panelIndex, students) {
    const studentsContainer = document.getElementById(`panel-${panelIndex}-students`);
    
    if (!studentsContainer) return;
    
    if (!students || students.length === 0) {
      studentsContainer.innerHTML = '<div class="no-data"><p>No student data available for this assignment.</p></div>';
      return;
    }
    
    let html = '';
    students.forEach(student => {
      const currentQuestion = student.most_current_question_index || 0;
      const totalQuestions = student.number_of_questions || 0;
      const correctPercentage = student.percent_correct ? Math.round(student.percent_correct) : 0;
      
      const correctQuestions = student.number_of_questions_correct || 0;
      const incorrectQuestions = (currentQuestion - correctQuestions) > 0 ? (currentQuestion - correctQuestions) : 0;
      const remainingQuestions = totalQuestions - currentQuestion > 0 ? (totalQuestions - currentQuestion) : 0;
      
      const correctWidth = totalQuestions > 0 ? (correctQuestions / totalQuestions) * 100 : 0;
      const incorrectWidth = totalQuestions > 0 ? (incorrectQuestions / totalQuestions) * 100 : 0;
      const remainingWidth = totalQuestions > 0 ? (remainingQuestions / totalQuestions) * 100 : 0;
      
      html += `
        <div class="student-card" data-student-id="${student.student_id}">
          <div class="student-info">
            <h3>${student.full_name}</h3>
            <div class="score">${student.total_score || 0}</div>
          </div>
          <div class="progress-info">
            <div class="progress-text">
              <span>${currentQuestion}/${totalQuestions}/${correctPercentage}%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar">
                <div class="progress-segment correct" style="width: ${correctWidth}%"></div>
                <div class="progress-segment incorrect" style="width: ${incorrectWidth}%"></div>
                <div class="progress-segment remaining" style="width: ${remainingWidth}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    studentsContainer.innerHTML = html;
  }
  
  // Clear a panel
  function clearPanel(panelIndex) {
    const panel = document.getElementById(`panel-${panelIndex}`);
    panel.innerHTML = `
      <div class="panel-placeholder">
        <p>Select an assignment for this panel</p>
      </div>
    `;
    
    // Clear any existing interval for this panel
    if (intervalIds[panelIndex]) {
      clearInterval(intervalIds[panelIndex]);
      delete intervalIds[panelIndex];
    }
  }
});