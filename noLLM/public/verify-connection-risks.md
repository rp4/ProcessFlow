# Verifying Connection Risk Badges

## Test Procedure

1. **Load the test file**:
   - Open the SwimLanes application
   - Load `test-connection-risks.json`

2. **Check initial display**:
   - Connection "Flow 1" (node1 → node2) should show 2 risk badges
   - Connection "Flow 2" (node2 → node3) should show 1 risk badge
   - Connection "Complete" (node3 → node4) should show no risk badges

3. **Test adding risks to connections**:
   - Right-click on the "Complete" connection
   - Add a risk using the risk modal
   - Verify the risk badge appears immediately

4. **Test clicking on risk badges**:
   - Click on a connection risk badge
   - Verify the risk details modal opens
   - Verify you can edit/add/remove risks

## What was fixed:

1. **Initialized risks array**: Connections now start with an empty `risks: []` array when created
2. **Risk badge positioning**: Connection risk badges use the midpoint of the connection path
3. **Event handling**: Connection risk clicks trigger the appropriate modal

## Expected visual appearance:

- Risk badges should appear near the middle of connection lines
- High risk = Red triangle
- Medium risk = Orange triangle
- Low risk = Yellow triangle
- Badges with controls show orange instead of red

## Troubleshooting:

If badges still don't appear:
1. Open browser console and check for errors
2. Verify the connection object has a `risks` array
3. Check that `renderConnections()` is being called after risk updates
4. Ensure the SVG groups are properly nested