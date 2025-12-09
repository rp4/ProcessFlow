# How to Use the SwimLane JSON Generation Prompt

## Quick Start

1. **Copy the prompt**: Open `generate-swimlane-json.md` and copy the entire content
2. **Add your process description**: Replace `[PASTE YOUR PROCESS DESCRIPTION HERE]` at the bottom with your:
   - Process narrative
   - Interview transcript
   - Business requirements
   - Workflow documentation
   - Or any text describing a process
3. **Paste into your LLM**: Use with ChatGPT, Claude, or any other LLM
4. **Copy the JSON output**: The LLM will generate properly formatted JSON
5. **Import to SwimLanes**: Save as `.json` file and upload to the SwimLanes app

## Tips for Best Results

### Input Format Tips
- **Be specific about actors**: Clearly mention who does what
- **Use action verbs**: "Sales reviews", "Manager approves", "System sends"
- **Indicate decisions**: Use words like "if", "when", "decides", "checks"
- **Show sequence**: Use words like "then", "after", "next", "finally"

### Example Input Formats That Work Well

**Narrative Format:**
```
The hiring process begins when a candidate applies online. HR screens the application and if qualified, schedules a phone interview. The hiring manager conducts the interview and decides whether to proceed. If yes, HR arranges an on-site interview...
```

**Interview Transcript:**
```
Q: How does your order process work?
A: Well, first the customer places an order on our website. Then our system automatically checks inventory. If we have stock, it goes to fulfillment. If not, purchasing needs to order more...
```

**Bullet Points:**
```
• Customer submits request
• Support team triages issue
• If critical: escalate to senior support
• If normal: assign to available agent
• Agent resolves issue
• Customer confirms resolution
```

## Customization

### If the LLM's output needs adjustment:

1. **Too many nodes?** Add to prompt: "Combine related tasks into single nodes"
2. **Wrong node types?** Add: "Use 'decision' type only for yes/no questions"
3. **Poor positioning?** Add: "Space nodes evenly with x-positions at 100, 300, 500, 700"
4. **Missing connections?** Add: "Ensure every node (except end nodes) has at least one outgoing connection"

### Advanced Prompt Modifications

For complex processes, add these instructions:

```
Additional requirements:
- Maximum 6 lanes
- Maximum 20 nodes total
- Group similar activities in the same lane
- Use sub-processes for complex steps
- Add connection labels for all decision outcomes
```

## Validation Checklist

Before importing to SwimLanes, verify the JSON has:
- [ ] Unique IDs for all nodes and lanes
- [ ] Valid node types (start, process, decision, end)
- [ ] Position x-values between 100-1100
- [ ] Position y-values between 20-80
- [ ] All connections reference existing node IDs
- [ ] At least one start and one end node
- [ ] Color codes in hex format (#xxxxxx)

## Common Issues and Fixes

**Issue**: LLM adds markdown formatting
**Fix**: Add "Output raw JSON only, no code blocks" to prompt

**Issue**: IDs aren't unique
**Fix**: Add "Ensure all node IDs are unique (node_1, node_2, etc.)"

**Issue**: Connections are missing
**Fix**: Add "Every node except 'end' types must have an outgoing connection"

**Issue**: Colors are invalid
**Fix**: Add "Use only the provided hex color codes"

## Pro Tips

1. **Test with simple process first**: Try a 3-step process to verify format
2. **Iterate**: If first attempt isn't perfect, refine your description
3. **Use examples**: Show the LLM a working example first
4. **Batch processing**: Process multiple workflows in one session
5. **Save templates**: Keep successful outputs as templates for similar processes